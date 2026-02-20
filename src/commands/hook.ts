import { appendFile } from "node:fs/promises";
import path from "node:path";
import { findInitializedRepo, LOGS_DIR } from "../fs/init";
import { parseHookStdin, readHookStdin } from "../hooks/events";
import { isSupportedHookAgent } from "../hooks/types";
import { buildBetSelectionContext } from "../tracking/context";
import { applySelectionDecision } from "../tracking/decision";
import { selectBetWithClaude } from "../tracking/selector";
import type { AppliedDecisionResult, HookEvent, SelectionResult } from "../tracking/types";

type HookLogEntry = {
  agent: "claude-code";
  event: HookEvent;
  at: string;
  session_id?: string;
  bet_id?: string;
  confidence?: number;
  applied: boolean;
};

type AttributionLogEntry = {
  at: string;
  agent: "claude-code";
  event: HookEvent;
  session_id?: string;
  decision?: AppliedDecisionResult["decision"];
  applied: boolean;
  applied_steps: string[];
  error: string | null;
};

type HookDependencies = {
  readInput: () => Promise<string>;
  select: typeof selectBetWithClaude;
  apply: typeof applySelectionDecision;
  append: typeof appendFile;
};

const defaultDeps: HookDependencies = {
  readInput: readHookStdin,
  select: selectBetWithClaude,
  apply: applySelectionDecision,
  append: appendFile,
};

function isHookEvent(value: string): value is HookEvent {
  return (
    value === "user-prompt-submit" ||
    value === "post-tool-use" ||
    value === "post-tool-use-failure" ||
    value === "session-end"
  );
}

function selectLogDecision(selection: SelectionResult, applied: AppliedDecisionResult | null): AppliedDecisionResult["decision"] {
  if (applied) {
    return applied.decision;
  }

  if (selection.ok) {
    return selection.decision;
  }

  return {
    action: "none",
    confidence: 0,
    reason: selection.error,
  };
}

export async function runHook(agent: string, event: string, deps: HookDependencies = defaultDeps): Promise<number> {
  if (!isSupportedHookAgent(agent)) {
    console.error(`Unsupported hook agent '${agent}'. Only 'claude-code' is supported.`);
    return 1;
  }

  if (!isHookEvent(event)) {
    console.error(
      `Unsupported hook event '${event}'. Use one of: user-prompt-submit, post-tool-use, post-tool-use-failure, session-end.`,
    );
    return 1;
  }

  const found = await findInitializedRepo(process.cwd());
  if (!found) {
    return 0;
  }

  const at = new Date().toISOString();
  const rawInput = await deps.readInput().catch(() => "");
  const payload = parseHookStdin(rawInput, event);

  let selection: SelectionResult;
  let applied: AppliedDecisionResult | null = null;
  let error: string | null = null;

  try {
    const context = await buildBetSelectionContext(found.rootDir, event, payload);
    const debugLogPath = path.join(found.rootDir, LOGS_DIR, "hook_debug.log");
    selection = await deps.select(context, { debugLogPath });

    if (selection.ok) {
      applied = await deps.apply(context, selection.decision);
      if (applied.error) {
        error = applied.error;
      }
    } else {
      error = selection.error;
    }
  } catch (caught) {
    const message = (caught as Error).message;
    selection = {
      ok: false,
      error: `Hook attribution failed: ${message}`,
    };
    error = selection.error;
  }

  const decision = selectLogDecision(selection, applied);

  const attributionLine: AttributionLogEntry = {
    at,
    agent,
    event,
    session_id: payload?.sessionId,
    decision,
    applied: applied?.applied ?? false,
    applied_steps: applied?.appliedSteps ?? [],
    error,
  };

  const sessionLine: HookLogEntry = {
    agent,
    event,
    at,
    session_id: payload?.sessionId,
    bet_id: decision.bet_id,
    confidence: decision.confidence,
    applied: applied?.applied ?? false,
  };

  const attributionPath = path.join(found.rootDir, LOGS_DIR, "agent-attribution.jsonl");
  const sessionPath = path.join(found.rootDir, LOGS_DIR, "agent-sessions.jsonl");

  await deps.append(attributionPath, `${JSON.stringify(attributionLine)}\n`, "utf8");
  await deps.append(sessionPath, `${JSON.stringify(sessionLine)}\n`, "utf8");

  console.log('{}') // empty output on success is required
  return 0;
}
