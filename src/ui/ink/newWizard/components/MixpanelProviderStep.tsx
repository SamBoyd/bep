import type { SelectPromptRequest, TextPromptRequest } from "../types.js";
import { SelectStep } from "./SelectStep.js";
import { TextStep } from "./TextStep.js";

export function MixpanelProviderStep({
  prompt,
  selectedIndex,
  textValue,
}: {
  prompt: SelectPromptRequest | TextPromptRequest;
  selectedIndex: number;
  textValue: string;
}) {
  if ("options" in prompt) {
    return <SelectStep prompt={prompt} selectedIndex={selectedIndex} />;
  }

  return <TextStep prompt={prompt} value={textValue} />;
}
