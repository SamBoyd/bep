export type ManualLeadingIndicator = {
  type: "manual";
  operator: ManualComparisonOperator;
  target: number;
};

export type ManualComparisonOperator = "lt" | "lte" | "eq" | "gte" | "gt";

export type ParseManualLeadingIndicatorResult =
  | { ok: true; value: ManualLeadingIndicator }
  | { ok: false; error: string };

export function parseManualLeadingIndicator(value: unknown): ParseManualLeadingIndicatorResult {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "leading_indicator must be an object." };
  }

  const candidate = value as { type?: unknown; operator?: unknown; target?: unknown };

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

function isManualComparisonOperator(value: unknown): value is ManualComparisonOperator {
  return value === "lt" || value === "lte" || value === "eq" || value === "gte" || value === "gt";
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
