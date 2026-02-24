import { spawn } from "node:child_process";
import { appendFile } from "node:fs/promises";
import os from "node:os";
import { isValidBetId } from "../bep/id.js";
import type { SelectionContext, SelectionDecision, SelectionResult } from "./types.js";

const DEBUG = true;
const SELECTION_TIMEOUT_MS = 60000;
const OUTPUT_FORMAT_INSTRUCTION =
  "Return only one JSON object. Do not include markdown fences, commentary, or extra keys.";

type ClaudeEnvelope = {
  result?: string;
};

type ClaudeArrayEvent = {
  type?: unknown;
  result?: unknown;
  message?: {
    content?: Array<{ type?: unknown; text?: unknown }>;
  };
};

type RunClaudeArgs = {
  prompt: string;
  timeoutMs: number;
  onDebug?: (stage: DebugStage, message: string, data?: Record<string, unknown>) => void;
};

type RunClaudeFn = (args: RunClaudeArgs) => Promise<string>;
type DebugStage =
  | "build_prompt"
  | "spawn_start"
  | "spawn_stdout_chunk"
  | "spawn_stderr_chunk"
  | "spawn_close"
  | "parse_outer_json"
  | "parse_result_json"
  | "validate_decision"
  | "return_ok"
  | "return_error";

export type SelectBetOptions = {
  debugLogPath?: string;
};

type DebugEntry = {
  at: string;
  stage: DebugStage;
  event: SelectionContext["event"];
  session_id?: string;
  message: string;
  data?: Record<string, unknown>;
};

function sanitizeForJson(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }

  if (typeof value === "bigint") {
    return String(value);
  }

  return value;
}

async function writeDebug(debugLogPath: string | undefined, entry: DebugEntry): Promise<void> {
  if (!DEBUG || !debugLogPath) {
    return;
  }

  try {
    await appendFile(
      debugLogPath,
      `${JSON.stringify({
        ...entry,
        data: entry.data
          ? Object.fromEntries(Object.entries(entry.data).map(([key, value]) => [key, sanitizeForJson(value)]))
          : undefined,
      })}\n`,
      "utf8",
    );
  } catch {
    // Debug logging must never affect selector behavior.
  }
}

function stripGitEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const next: NodeJS.ProcessEnv = {};

  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith("GIT_")) {
      continue;
    }
    next[key] = value;
  }

  return next;
}

async function defaultRunClaude({ prompt, timeoutMs, onDebug }: RunClaudeArgs): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    void onDebug?.("spawn_start", "Starting claude selector subprocess.", {
      command: "claude",
      args: ["--print", "--output-format", "json", "--model", "sonnet", "--setting-sources", ""],
      cwd: os.tmpdir(),
      timeoutMs,
    });

    const child = spawn(
      "claude",
      ["--print", "--output-format", "json", "--model", "sonnet", "--setting-sources", ""],
      {
        cwd: os.tmpdir(),
        env: stripGitEnv(process.env),
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      void onDebug?.("spawn_stdout_chunk", "Received stdout chunk from claude selector.", { chunk });
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
      void onDebug?.("spawn_stderr_chunk", "Received stderr chunk from claude selector.", { chunk });
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      void onDebug?.("spawn_close", "Claude selector subprocess closed.", { code, timedOut, stderr });
      if (timedOut) {
        reject(new Error(`Claude selector timed out after ${timeoutMs}ms.`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`Claude selector failed with exit code ${code}: ${stderr.trim()}`));
        return;
      }

      resolve(stdout);
    });

    child.stdin.end(prompt);
  });
}

function maybeExtractJsonFromMarkdown(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (match && match[1]) {
    return match[1].trim();
  }

  return trimmed;
}

function extractDecisionFromArrayEnvelope(events: unknown[]): unknown | null {
  const typed = events.filter((entry) => entry && typeof entry === "object") as ClaudeArrayEvent[];

  const resultEvent = typed.find((entry) => entry.type === "result" && typeof entry.result === "string");
  if (resultEvent && typeof resultEvent.result === "string") {
    const body = maybeExtractJsonFromMarkdown(resultEvent.result);
    return JSON.parse(body);
  }

  const assistantEvent = typed.find((entry) => entry.type === "assistant" && Array.isArray(entry.message?.content));
  if (!assistantEvent || !Array.isArray(assistantEvent.message?.content)) {
    return null;
  }

  for (const block of assistantEvent.message.content) {
    if (block?.type !== "text" || typeof block.text !== "string") {
      continue;
    }

    const body = maybeExtractJsonFromMarkdown(block.text);
    return JSON.parse(body);
  }

  return null;
}

function toDecision(raw: unknown, knownIds: Set<string>): SelectionDecision | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Record<string, unknown>;
  const action = candidate.action;
  const confidence = candidate.confidence;
  const reason = candidate.reason;

  if (
    action !== "start" &&
    action !== "stop" &&
    action !== "switch" &&
    action !== "keep" &&
    action !== "none"
  ) {
    return null;
  }

  if (typeof confidence !== "number" || !Number.isFinite(confidence)) {
    return null;
  }

  if (typeof reason !== "string" || reason.trim().length === 0) {
    return null;
  }

  const betId = typeof candidate.bet_id === "string" ? candidate.bet_id : undefined;
  const stopBetId = typeof candidate.stop_bet_id === "string" ? candidate.stop_bet_id : undefined;

  if (betId && (!isValidBetId(betId) || !knownIds.has(betId))) {
    return null;
  }

  if (stopBetId && (!isValidBetId(stopBetId) || !knownIds.has(stopBetId))) {
    return null;
  }

  return {
    action,
    bet_id: betId,
    stop_bet_id: stopBetId,
    confidence,
    reason: reason.trim(),
  };
}

function buildPrompt(context: SelectionContext): string {
  const bets = context.bets
    .map((bet) => ({
      id: bet.id,
      status: bet.status,
      assumption: bet.assumption,
      rationale: bet.rationale,
      validation_plan: bet.validationPlan,
      notes: bet.notes,
      summary: bet.summary,
    }))
    .slice(0, 50);

  const payload = context.payload
    ? {
        session_id: context.payload.sessionId,
        prompt: context.payload.prompt,
        tool_name: context.payload.toolName,
        tool_input: context.payload.toolInput,
        tool_output: context.payload.toolOutput,
        transcript_path: context.payload.transcriptPath,
        cwd: context.payload.cwd,
      }
    : null;

  const recent = context.recentAttribution.map((entry) => ({
    at: entry.at,
    event: entry.event,
    session_id: entry.session_id,
    decision: entry.decision,
  }));

  const eventSpecificPolicy =
    context.event === "session-end"
      ? [
          "Event-specific policy for session-end:",
          "- If an active bet exists, prefer action 'stop' for the current/inferred active bet.",
          "- Action 'keep' is generally incorrect at session end unless there is a strong explicit reason.",
          "- Use action 'none' only when no active/inferable bet can be identified.",
        ]
      : context.event === "user-prompt-submit"
        ? [
            "Event-specific policy for user-prompt-submit:",
            "- Use 'start' or 'switch' only when intent is explicit or strongly inferred.",
            "- Prefer 'none' when intent is weak or ambiguous.",
          ]
        : [
            "Event-specific policy for tool events:",
            "- Treat tool events as reinforcement signals, not sole evidence for high-confidence switches.",
            "- Prefer 'none' when evidence is insufficient.",
          ];

  return [
    "You are selecting BEP bet attribution actions for a coding session.",
    "Constraints:",
    "- Choose only bet IDs listed in provided bets.",
    "- Prefer action 'none' when uncertain.",
    "- Never invent bet IDs.",
    "- Output must follow the required JSON schema.",
    OUTPUT_FORMAT_INSTRUCTION,
    "",
    "Action semantics:",
    "- start: begin tracking a specific bet.",
    "- stop: pause tracking a specific active bet.",
    "- switch: stop old bet and start new bet when shift is clear.",
    "- keep: tracking should remain unchanged (discouraged for session-end).",
    "- none: insufficient evidence or no valid target.",
    "",
    ...eventSpecificPolicy,
    "",
    "Required JSON schema:",
    '{"action":"start|stop|switch|keep|none","bet_id":"optional","stop_bet_id":"optional","confidence":0-1,"reason":"short"}',
    "",
    "Context JSON:",
    JSON.stringify(
      {
        event: context.event,
        active_bets: context.activeBetIds,
        payload,
        bets,
        recent_attribution: recent,
      },
      null,
      2,
    ),
  ].join("\n");
}

export async function selectBetWithClaude(
  context: SelectionContext,
  runClaudeOrOptions: RunClaudeFn | SelectBetOptions = defaultRunClaude,
  maybeOptions: SelectBetOptions = {},
): Promise<SelectionResult> {
  const runClaude = typeof runClaudeOrOptions === "function" ? runClaudeOrOptions : defaultRunClaude;
  const options = typeof runClaudeOrOptions === "function" ? maybeOptions : runClaudeOrOptions;

  const debugLog = (stage: DebugStage, message: string, data?: Record<string, unknown>): Promise<void> =>
    writeDebug(options.debugLogPath, {
      at: new Date().toISOString(),
      stage,
      event: context.event,
      session_id: context.payload?.sessionId,
      message,
      data,
    });

  if (context.bets.length === 0) {
    await debugLog("return_ok", "No bets available. Returning no-op decision.");
    return {
      ok: true,
      decision: {
        action: "none",
        confidence: 1,
        reason: "No bets available for attribution.",
      },
      rawText: "",
    };
  }

  const prompt = buildPrompt(context);
  await debugLog("build_prompt", "Built Claude selector prompt.", {
    prompt,
    activeBetIds: context.activeBetIds,
    betIds: context.bets.map((bet) => bet.id),
  });

  let rawText = "";
  try {
    rawText = await runClaude({
      prompt,
      timeoutMs: SELECTION_TIMEOUT_MS,
      onDebug: (stage, message, data) => {
        void debugLog(stage, message, data);
      },
    });
  } catch (error) {
    await debugLog("return_error", "Claude selector subprocess failed.", {
      error,
    });
    return {
      ok: false,
      error: `Failed to run Claude selector: ${(error as Error).message}`,
    };
  }

  const trimmed = rawText.trim();
  if (trimmed.length === 0) {
    await debugLog("return_error", "Claude selector returned empty output.");
    return {
      ok: false,
      error: "Claude selector returned empty output.",
      rawText,
    };
  }

  let outer: unknown;
  try {
    await debugLog("parse_outer_json", "Parsing outer Claude output JSON.", { rawText });
    outer = JSON.parse(trimmed);
  } catch {
    await debugLog("return_error", "Failed to parse outer Claude output as JSON.", { rawText });
    return {
      ok: false,
      error: "Claude selector returned non-JSON output.",
      rawText,
    };
  }

  let decisionValue: unknown = outer;
  if (Array.isArray(outer)) {
    try {
      await debugLog("parse_result_json", "Parsing Claude array envelope.", { eventCount: outer.length });
      decisionValue = extractDecisionFromArrayEnvelope(outer);
    } catch {
      await debugLog("return_error", "Failed to parse decision from Claude array envelope.", { rawText });
      return {
        ok: false,
        error: "Claude selector array envelope did not contain valid JSON decision.",
        rawText,
      };
    }

    if (!decisionValue) {
      await debugLog("return_error", "Claude array envelope missing decision payload.", { rawText });
      return {
        ok: false,
        error: "Claude selector array envelope did not include a decision payload.",
        rawText,
      };
    }
  } else if (outer && typeof outer === "object" && typeof (outer as ClaudeEnvelope).result === "string") {
    const body = maybeExtractJsonFromMarkdown((outer as ClaudeEnvelope).result ?? "");
    try {
      await debugLog("parse_result_json", "Parsing Claude envelope result JSON.", { body });
      decisionValue = JSON.parse(body);
    } catch {
      await debugLog("return_error", "Failed to parse Claude envelope result JSON.", { body, rawText });
      return {
        ok: false,
        error: "Claude selector result field did not contain valid JSON decision.",
        rawText,
      };
    }
  }

  const knownIds = new Set(context.bets.map((bet) => bet.id));
  const parsedDecision = toDecision(decisionValue, knownIds);
  await debugLog("validate_decision", "Validating selector decision schema.", {
    decisionValue,
    knownIds: Array.from(knownIds),
    valid: parsedDecision !== null,
  });
  if (!parsedDecision) {
    await debugLog("return_error", "Selector decision failed schema validation.", { decisionValue, rawText });
    return {
      ok: false,
      error: "Claude selector decision failed schema validation.",
      rawText,
    };
  }

  if (context.event === "session-end" && parsedDecision.action === "keep") {
    await debugLog("validate_decision", "Session-end returned keep; this conflicts with preferred stop policy.", {
      decision: parsedDecision,
      activeBetIds: context.activeBetIds,
    });
  }

  await debugLog("return_ok", "Selector decision parsed successfully.", {
    decision: parsedDecision,
  });
  return {
    ok: true,
    decision: parsedDecision,
    rawText,
  };
}
