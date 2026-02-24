import { isValidBetId } from "../bep/id.js";
import { runStart } from "../commands/start.js";
import { runStop } from "../commands/stop.js";
import type { AppliedDecisionResult, SelectionDecision, SelectionContext } from "./types.js";

const DEFAULT_CONFIDENCE_THRESHOLD = 0.75;

type ActionDeps = {
  start: (id: string) => Promise<number>;
  stop: (id: string) => Promise<number>;
};

const defaultDeps: ActionDeps = {
  start: runStart,
  stop: runStop,
};

function noOp(decision: SelectionDecision): AppliedDecisionResult {
  return {
    applied: false,
    appliedSteps: [],
    decision,
  };
}

function hasValidBet(decision: SelectionDecision, knownBetIds: Set<string>, key: "bet_id" | "stop_bet_id"): boolean {
  const id = decision[key];
  if (!id) {
    return false;
  }

  return isValidBetId(id) && knownBetIds.has(id);
}

export async function applySelectionDecision(
  context: SelectionContext,
  rawDecision: SelectionDecision,
  deps: ActionDeps = defaultDeps,
): Promise<AppliedDecisionResult> {
  const confidence = Number.isFinite(rawDecision.confidence) ? rawDecision.confidence : 0;
  const decision: SelectionDecision = {
    ...rawDecision,
    confidence,
  };

  const knownBetIds = new Set(context.bets.map((bet) => bet.id));

  if (decision.confidence < DEFAULT_CONFIDENCE_THRESHOLD) {
    return noOp({
      ...decision,
      action: "none",
      reason: `${decision.reason} (below confidence threshold)`,
    });
  }

  if (decision.action === "none" || decision.action === "keep") {
    return noOp(decision);
  }

  if (decision.action === "start") {
    if (!hasValidBet(decision, knownBetIds, "bet_id")) {
      return noOp({ ...decision, action: "none", reason: `${decision.reason} (invalid start bet)` });
    }

    const code = await deps.start(decision.bet_id as string);
    if (code !== 0) {
      return {
        applied: false,
        appliedSteps: [],
        decision,
        error: `Failed to start bet '${decision.bet_id}'.`,
      };
    }

    return {
      applied: true,
      appliedSteps: [`start:${decision.bet_id}`],
      decision,
    };
  }

  if (decision.action === "stop") {
    if (!hasValidBet(decision, knownBetIds, "bet_id")) {
      return noOp({ ...decision, action: "none", reason: `${decision.reason} (invalid stop bet)` });
    }

    const code = await deps.stop(decision.bet_id as string);
    if (code !== 0) {
      return {
        applied: false,
        appliedSteps: [],
        decision,
        error: `Failed to stop bet '${decision.bet_id}'.`,
      };
    }

    return {
      applied: true,
      appliedSteps: [`stop:${decision.bet_id}`],
      decision,
    };
  }

  if (decision.action === "switch") {
    const hasStart = hasValidBet(decision, knownBetIds, "bet_id");
    if (!hasStart) {
      return noOp({ ...decision, action: "none", reason: `${decision.reason} (invalid switch target)` });
    }

    const stopId = hasValidBet(decision, knownBetIds, "stop_bet_id")
      ? (decision.stop_bet_id as string)
      : context.activeBetIds.find((id) => id !== decision.bet_id);

    if (stopId && stopId === decision.bet_id) {
      return noOp({ ...decision, action: "keep", reason: `${decision.reason} (switch target already active)` });
    }

    const appliedSteps: string[] = [];

    if (stopId) {
      const stopCode = await deps.stop(stopId);
      if (stopCode !== 0) {
        return {
          applied: false,
          appliedSteps,
          decision,
          error: `Failed to stop bet '${stopId}' during switch.`,
        };
      }
      appliedSteps.push(`stop:${stopId}`);
    }

    const startCode = await deps.start(decision.bet_id as string);
    if (startCode !== 0) {
      return {
        applied: false,
        appliedSteps,
        decision,
        error: `Failed to start bet '${decision.bet_id}' during switch.`,
      };
    }
    appliedSteps.push(`start:${decision.bet_id}`);

    return {
      applied: true,
      appliedSteps,
      decision,
    };
  }

  return noOp({ ...decision, action: "none", reason: `${decision.reason} (unsupported action)` });
}
