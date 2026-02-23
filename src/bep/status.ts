export type ValidationStatus = "pending" | "passed";

export function normalizeValidationStatus(value: unknown): ValidationStatus {
  return value === "passed" ? "passed" : "pending";
}

