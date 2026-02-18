export type ManualLeadingIndicator = {
  type: "manual";
  target: string;
};

export type ParseManualLeadingIndicatorResult =
  | { ok: true; value: ManualLeadingIndicator }
  | { ok: false; error: string };

export function parseManualLeadingIndicator(value: unknown): ParseManualLeadingIndicatorResult {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "leading_indicator must be an object." };
  }

  const candidate = value as { type?: unknown; target?: unknown };

  if (candidate.type !== "manual") {
    return { ok: false, error: 'leading_indicator.type must equal "manual".' };
  }

  if (typeof candidate.target !== "string" || candidate.target.trim().length === 0) {
    return { ok: false, error: "leading_indicator.target must be a non-empty string." };
  }

  return {
    ok: true,
    value: {
      type: "manual",
      target: candidate.target.trim(),
    },
  };
}
