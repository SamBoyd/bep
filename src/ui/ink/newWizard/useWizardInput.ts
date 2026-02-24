import { useInput } from "ink";
import type { WizardPrompt, WizardUiState, WizardStateActions } from "./useWizardState.js";

export function useWizardInput(
  prompt: WizardPrompt,
  uiState: WizardUiState,
  actions: WizardStateActions,
): void {
  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      actions.cancel();
      return;
    }

    if (key.escape) {
      actions.goBack();
      return;
    }

    if ("options" in prompt) {
      if (key.downArrow || input === "j") {
        actions.setUiState((previous) => ({
          ...previous,
          selectIndex: Math.min(prompt.options.length - 1, previous.selectIndex + 1),
          error: undefined,
        }));
        return;
      }

      if (key.upArrow || input === "k") {
        actions.setUiState((previous) => ({
          ...previous,
          selectIndex: Math.max(0, previous.selectIndex - 1),
          error: undefined,
        }));
        return;
      }

      if (key.return) {
        const option = prompt.options[uiState.selectIndex];
        if (option) {
          actions.submitSelect(option.value);
        }
      }

      return;
    }

    if (key.return) {
      actions.submitText();
      return;
    }

    if (key.backspace || key.delete) {
      actions.setUiState((previous) => ({
        ...previous,
        textValue: previous.textValue.slice(0, -1),
        error: undefined,
      }));
      return;
    }

    if (input.length > 0 && !key.tab) {
      actions.setUiState((previous) => ({
        ...previous,
        textValue: previous.textValue + input,
        error: undefined,
      }));
    }
  });
}
