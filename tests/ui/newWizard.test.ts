import {
  type CapTypePromptResult,
  runNewWizard,
  type ActionPromptResult,
  type LeadingIndicatorTargetPromptResult,
  type NumberPromptResult,
  type WizardPromptClient,
} from "../../src/ui/newWizard";

type ScriptedStep =
  | { type: "capType"; result: CapTypePromptResult }
  | { type: "capValue"; result: NumberPromptResult }
  | { type: "action"; result: ActionPromptResult }
  | { type: "leadingIndicatorTarget"; result: LeadingIndicatorTargetPromptResult };

function createScriptedClient(steps: ScriptedStep[]): WizardPromptClient {
  return {
    async promptCapType() {
      const next = steps.shift();
      if (!next || next.type !== "capType") {
        throw new Error("Unexpected cap type prompt");
      }
      return next.result;
    },
    async promptCapValue() {
      const next = steps.shift();
      if (!next || next.type !== "capValue") {
        throw new Error("Unexpected cap value prompt");
      }
      return next.result;
    },
    async promptDefaultAction() {
      const next = steps.shift();
      if (!next || next.type !== "action") {
        throw new Error("Unexpected action prompt");
      }
      return next.result;
    },
    async promptLeadingIndicatorTarget() {
      const next = steps.shift();
      if (!next || next.type !== "leadingIndicatorTarget") {
        throw new Error("Unexpected leading indicator target prompt");
      }
      return next.result;
    },
  };
}

describe("runNewWizard", () => {
  test("completes in forward-only flow", async () => {
    const client = createScriptedClient([
      { type: "capType", result: { kind: "value", value: "max_hours" } },
      { type: "capValue", result: { kind: "value", value: 12 } },
      { type: "action", result: { kind: "value", value: "kill" } },
      { type: "leadingIndicatorTarget", result: { kind: "value", value: ">= 20 signups in 7d" } },
    ]);

    const result = await runNewWizard(client);

    expect(result).toEqual({
      cancelled: false,
      values: {
        maxHours: 12,
        maxCalendarDays: undefined,
        defaultAction: "kill",
        leadingIndicatorTarget: ">= 20 signups in 7d",
      },
    });
  });

  test("supports one-step back navigation and allows changing cap type", async () => {
    const client = createScriptedClient([
      { type: "capType", result: { kind: "value", value: "max_hours" } },
      { type: "capValue", result: { kind: "value", value: 12 } },
      { type: "action", result: { kind: "back" } },
      { type: "capValue", result: { kind: "back" } },
      { type: "capType", result: { kind: "value", value: "max_calendar_days" } },
      { type: "capValue", result: { kind: "value", value: 9 } },
      { type: "action", result: { kind: "value", value: "pivot" } },
      { type: "leadingIndicatorTarget", result: { kind: "value", value: ">= 10 activations" } },
    ]);

    const result = await runNewWizard(client, () => undefined);

    expect(result).toEqual({
      cancelled: false,
      values: {
        maxHours: undefined,
        maxCalendarDays: 9,
        defaultAction: "pivot",
        leadingIndicatorTarget: ">= 10 activations",
      },
    });
  });

  test("returns cancelled when prompt is cancelled", async () => {
    const client = createScriptedClient([{ type: "capType", result: { kind: "cancel" } }]);

    const result = await runNewWizard(client, () => undefined);

    expect(result).toEqual({ cancelled: true });
  });
});
