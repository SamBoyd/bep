import { isCancel, text } from "@clack/prompts";

export type CheckPromptResult =
  | { cancelled: true }
  | { cancelled: false; observedValue: string; notes?: string };

export type CheckPromptClient = {
  promptObservedValue(): Promise<string | symbol>;
  promptNotes(): Promise<string | symbol>;
};

export function createClackCheckPromptClient(): CheckPromptClient {
  return {
    async promptObservedValue() {
      return text({
        message: "Observed value (required)",
        validate(rawValue) {
          if (rawValue.trim().length === 0) {
            return "Enter an observed value.";
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

  const observedValue = observed.trim();
  const trimmedNotes = (notes || '').trim();

  return {
    cancelled: false,
    observedValue,
    notes: trimmedNotes.length > 0 ? trimmedNotes : undefined,
  };
}
