import { WizardFrame } from "./components/WizardFrame.js";
import { SelectStep } from "./components/SelectStep.js";
import { TextStep } from "./components/TextStep.js";
import { useWizardInput } from "./useWizardInput.js";
import { useWizardState } from "./useWizardState.js";
import type { NewWizardResult } from "../../newWizardPromptTypes.js";

export function InkNewWizardApp({ onComplete }: { onComplete: (result: NewWizardResult) => void }) {
  const { prompt, uiState, actions } = useWizardState(onComplete);
  useWizardInput(prompt, uiState, actions);

  return (
    <WizardFrame title={prompt.title} helpText={prompt.helpText} allowBack={prompt.allowBack} error={uiState.error}>
      {"options" in prompt ? (
        <SelectStep prompt={prompt} selectedIndex={uiState.selectIndex} />
      ) : (
        <TextStep prompt={prompt} value={uiState.textValue} />
      )}
    </WizardFrame>
  );
}
