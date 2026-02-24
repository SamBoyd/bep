import { runCheckPrompt } from "../ui/checkPrompt.js";
import type {
  ManualComparisonOperator,
  ManualLeadingIndicator,
  ProviderAdapter,
  ProviderModule,
  ProviderParseResult,
} from "./types.js";

function isManualComparisonOperator(value: unknown): value is ManualComparisonOperator {
  return value === "lt" || value === "lte" || value === "eq" || value === "gte" || value === "gt";
}

export function parseManualLeadingIndicator(input: unknown): ProviderParseResult<ManualLeadingIndicator> {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "leading_indicator must be an object." };
  }

  const candidate = input as { type?: unknown; operator?: unknown; target?: unknown };

  if (candidate.type !== "manual") {
    return { ok: false, error: 'leading_indicator.type must equal "manual".' };
  }

  if (!isManualComparisonOperator(candidate.operator)) {
    return { ok: false, error: 'leading_indicator.operator must be one of "lt", "lte", "eq", "gte", "gt".' };
  }

  if (typeof candidate.target !== "number" || !Number.isFinite(candidate.target)) {
    return { ok: false, error: "leading_indicator.target must be a finite number." };
  }

  return {
    ok: true,
    value: {
      type: "manual",
      operator: candidate.operator,
      target: candidate.target,
    },
  };
}

export function evaluateManualComparison(
  observedValue: number,
  operator: ManualComparisonOperator,
  target: number,
): boolean {
  if (operator === "lt") {
    return observedValue < target;
  }

  if (operator === "lte") {
    return observedValue <= target;
  }

  if (operator === "eq") {
    return observedValue === target;
  }

  if (operator === "gte") {
    return observedValue >= target;
  }

  return observedValue > target;
}

export function formatManualComparisonOperator(operator: ManualComparisonOperator): string {
  if (operator === "lt") {
    return "<";
  }

  if (operator === "lte") {
    return "<=";
  }

  if (operator === "eq") {
    return "=";
  }

  if (operator === "gte") {
    return ">=";
  }

  return ">";
}

export const manualAdapter: ProviderAdapter<ManualLeadingIndicator> = {
  type: "manual",
  parseIndicator(input) {
    return parseManualLeadingIndicator(input);
  },
  async runCheck(indicator) {
    const promptResult = await runCheckPrompt();
    if (promptResult.cancelled) {
      return { cancelled: true };
    }

    return {
      observedValue: promptResult.observedValue,
      meetsTarget: evaluateManualComparison(promptResult.observedValue, indicator.operator, indicator.target),
      notes: promptResult.notes,
    };
  },
};

export const manualProviderModule: ProviderModule<ManualLeadingIndicator> = {
  adapter: manualAdapter,
};
