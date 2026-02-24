import { renderNewWizardInk } from "./ink/newWizard/renderNewWizardInk.js";
import type { NewWizardOptions, NewWizardResult, NewWizardValues, OptionalNumberField } from "./newWizardPromptTypes.js";

export type { NewWizardOptions, NewWizardResult, NewWizardValues, OptionalNumberField } from "./newWizardPromptTypes.js";

export async function runNewWizard(options: NewWizardOptions): Promise<NewWizardResult> {
  return renderNewWizardInk(options);
}
