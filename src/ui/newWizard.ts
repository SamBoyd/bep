import { renderNewWizardInk } from "./ink/newWizard/renderNewWizardInk.js";
import type { NewWizardResult, NewWizardValues, OptionalNumberField } from "./newWizardPromptTypes.js";

export type { NewWizardResult, NewWizardValues, OptionalNumberField } from "./newWizardPromptTypes.js";

export async function runNewWizard(): Promise<NewWizardResult> {
  return renderNewWizardInk();
}
