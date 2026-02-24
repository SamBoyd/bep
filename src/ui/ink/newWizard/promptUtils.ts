import type { SelectPromptOption } from "./types.js";

export function getInitialSelectIndex(options: SelectPromptOption[], initialValue?: string): number {
  if (!initialValue) {
    return 0;
  }

  const index = options.findIndex((option) => option.value === initialValue);
  return index >= 0 ? index : 0;
}

export function classifyTextSubmission(
  rawValue: string,
  options: {
    allowBack: boolean;
    validate?: (rawValue: string) => string | undefined;
  },
): { kind: "value"; value: string } | { kind: "back" } | { kind: "invalid"; message: string } {
  const trimmed = rawValue.trim();

  if (options.allowBack && trimmed.toLowerCase() === "b") {
    return { kind: "back" };
  }

  const error = options.validate?.(rawValue);
  if (error) {
    return { kind: "invalid", message: error };
  }

  return { kind: "value", value: rawValue };
}
