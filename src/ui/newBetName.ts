import { isCancel, text } from "@clack/prompts";

type NewBetNameResult = { cancelled: true } | { cancelled: false; value: string };

export function normalizeBetName(value: string): string {
  return value.trim().replace(/\s+/g, "_").toLowerCase();
}

export async function promptNewBetName(): Promise<NewBetNameResult> {
  const response = await text({
    message: "Bet name",
    placeholder: "Landing page iteration",
    validate(input) {
      return input.trim().length > 0 ? undefined : "Bet name is required.";
    },
  });

  if (isCancel(response)) {
    return { cancelled: true };
  }

  return {
    cancelled: false,
    value: normalizeBetName(response),
  };
}
