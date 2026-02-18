import { isCancel, text } from "@clack/prompts";

export type CheckPromptResult =
  | { cancelled: true }
  | { cancelled: false; observedValue: number; notes?: string };

export type CheckPromptClient = {
  promptObservedValue(): Promise<string | symbol>;
  promptNotes(): Promise<string | symbol>;
};

export function createClackCheckPromptClient(): CheckPromptClient {
  return {
    async promptObservedValue() {
      return text({
        message: "Observed value (required, numeric)",
        validate(rawValue) {
          const trimmed = rawValue.trim();
          if (trimmed.length === 0 || !Number.isFinite(Number(trimmed))) {
            return "Enter a valid number.";
          }
        },
      });
    },
    async promptNotes() {
      return text({
        message: "Notes (optional)",
      });
    },
  };
}

export async function runCheckPrompt(
  client: CheckPromptClient = createClackCheckPromptClient(),
): Promise<CheckPromptResult> {
  const observed = await client.promptObservedValue();
  if (isCancel(observed)) {
    return { cancelled: true };
  }

  const notes = await client.promptNotes();
  if (isCancel(notes)) {
    return { cancelled: true };
  }

  const observedValue = Number(observed.trim());
  const trimmedNotes = (notes || "").trim();

  return {
    cancelled: false,
    observedValue,
    notes: trimmedNotes.length > 0 ? trimmedNotes : undefined,
  };
}
