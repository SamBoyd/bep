import { render } from "ink";
import { createElement } from "react";
import { InkNewWizardApp } from "./App.js";
import type { NewWizardResult } from "../../newWizardPromptTypes.js";

export async function renderNewWizardInk(): Promise<NewWizardResult> {
  return await new Promise<NewWizardResult>((resolve, reject) => {
    let settled = false;

    const app = render(
      createElement(InkNewWizardApp, {
        onComplete(result: NewWizardResult) {
          if (settled) {
            return;
          }

          settled = true;
          resolve(result);
          app.unmount();
        },
      }),
    );

    app.waitUntilExit().catch((error) => {
      if (settled) {
        return;
      }

      settled = true;
      reject(error);
    });
  });
}
