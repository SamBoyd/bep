import { appendFile } from "node:fs/promises";
import path from "node:path";
import { findInitializedRepo, LOGS_DIR } from "../fs/init.js";
import { parseHookStdin, readHookStdin } from "../hooks/events.js";
import { isSupportedHookAgent } from "../hooks/types.js";
import { buildBetSelectionContext } from "../tracking/context.js";
import { applySelectionDecision } from "../tracking/decision.js";
import { evaluateCapGate } from "../tracking/enforcement.js";
import { selectBetWithClaude } from "../tracking/selector.js";
import type { AppliedDecisionResult, HookEvent, SelectionResult } from "../tracking/types.js";

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

type BlockLogEntry = {
  at: string;
  agent: "claude-code";
  event: HookEvent;
  session_id?: string;
  bet_id?: string;
  cap_type?: "max_hours" | "max_calendar_days";
  cap_value?: number;
  used_value?: number;
  percent_used?: number;
  over_cap: boolean;
  enforced: boolean;
  reason: string;
};

type HookDependencies = {
  readInput: () => Promise<string>;
  select: typeof selectBetWithClaude;
  apply: typeof applySelectionDecision;
  append: typeof appendFile;
  writeOutput?: (output: string) => void | boolean;
};

const defaultDeps: HookDependencies = {
  readInput: readHookStdin,
  select: selectBetWithClaude,
  apply: applySelectionDecision,
  append: appendFile,
  writeOutput: (output: string) => process.stdout.write(output),
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
  const writeOutput = deps.writeOutput ?? defaultDeps.writeOutput;
  const rawInput = await deps.readInput().catch(() => "");
  const payload = parseHookStdin(rawInput, event);

  let selection: SelectionResult;
  let applied: AppliedDecisionResult | null = null;
  let error: string | null = null;
  let promptDenied = false;
  let promptDenyReason: string | null = null;
  let blockLine: BlockLogEntry | null = null;

  try {
    const context = await buildBetSelectionContext(found.rootDir, event, payload);
    const debugLogPath = path.join(found.rootDir, LOGS_DIR, "hook_debug.log");
    selection = await deps.select(context, { debugLogPath });

    if (selection.ok) {
      const gate = await evaluateCapGate(found.rootDir, context, selection.decision);
      if (gate.overCap) {
        blockLine = {
          at,
          agent,
          event,
          session_id: payload?.sessionId,
          bet_id: gate.targetBetId,
          cap_type: gate.capType,
          cap_value: gate.capValue,
          used_value: gate.usedValue,
          percent_used: gate.percentUsed,
          over_cap: true,
          enforced: event === "user-prompt-submit",
          reason: gate.reason,
        };
      }

      if (event === "user-prompt-submit" && gate.overCap) {
        promptDenied = true;
        promptDenyReason = `Bet '${gate.targetBetId ?? "unknown"}' is at cap (${(gate.usedValue ?? 0).toFixed(2)} ${gate.capType === "max_calendar_days" ? "days" : "hours"} / ${(gate.capValue ?? 0).toFixed(2)} ${gate.capType === "max_calendar_days" ? "days" : "hours"}, ${(gate.percentUsed ?? 0).toFixed(2)}%). Update bets/${gate.targetBetId}.md to extend cap or change status before continuing.`;
      } else {
        applied = await deps.apply(context, selection.decision);
        if (applied.error) {
          error = applied.error;
        }
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
  const blocksPath = path.join(found.rootDir, LOGS_DIR, "agent-blocks.jsonl");

  if (blockLine) {
    await deps.append(blocksPath, `${JSON.stringify(blockLine)}\n`, "utf8");
  }

  await deps.append(attributionPath, `${JSON.stringify(attributionLine)}\n`, "utf8");
  await deps.append(sessionPath, `${JSON.stringify(sessionLine)}\n`, "utf8");

  if (event === "user-prompt-submit" && promptDenied) {
    writeOutput?.(JSON.stringify({ continue: false, stopReason: promptDenyReason ?? "Bet is hard-blocked at cap." }));
    return 0;
  }

  if (event === "user-prompt-submit") {
    writeOutput?.(JSON.stringify({ continue: true }));
    return 0;
  }

  writeOutput?.(JSON.stringify({ continue: true }));
  return 0;
}
