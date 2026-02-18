import {
  type CapTypePromptResult,
  runNewWizard,
  type ActionPromptResult,
  type LeadingIndicatorTypePromptResult,
  type NumberPromptResult,
  type WizardPromptClient,
} from "../../src/ui/newWizard";
import type { ManualOperatorPromptResult, ManualTargetPromptResult } from "../../src/providers/manual";

type ScriptedStep =
  | { type: "capType"; result: CapTypePromptResult }
  | { type: "capValue"; result: NumberPromptResult }
  | { type: "action"; result: ActionPromptResult }
  | { type: "leadingIndicatorType"; result: LeadingIndicatorTypePromptResult }
  | { type: "manualOperator"; result: ManualOperatorPromptResult }
  | { type: "manualTarget"; result: ManualTargetPromptResult };

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
    async promptLeadingIndicatorType() {
      const next = steps.shift();
      if (!next || next.type !== "leadingIndicatorType") {
        throw new Error("Unexpected leading indicator type prompt");
      }
      return next.result;
    },
    async promptManualOperator() {
      const next = steps.shift();
      if (!next || next.type !== "manualOperator") {
        throw new Error("Unexpected manual operator prompt");
      }
      return next.result;
    },
    async promptManualTarget() {
      const next = steps.shift();
      if (!next || next.type !== "manualTarget") {
        throw new Error("Unexpected manual target prompt");
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
      { type: "leadingIndicatorType", result: { kind: "value", value: "manual" } },
      { type: "manualOperator", result: { kind: "value", value: "gte" } },
      { type: "manualTarget", result: { kind: "value", value: 20 } },
    ]);

    const result = await runNewWizard(client);

    expect(result).toEqual({
      cancelled: false,
      values: {
        maxHours: 12,
        maxCalendarDays: undefined,
        defaultAction: "kill",
        leadingIndicator: {
          type: "manual",
          operator: "gte",
          target: 20,
        },
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
      { type: "leadingIndicatorType", result: { kind: "value", value: "manual" } },
      { type: "manualOperator", result: { kind: "value", value: "gt" } },
      { type: "manualTarget", result: { kind: "value", value: 10 } },
    ]);

    const result = await runNewWizard(client, () => undefined);

    expect(result).toEqual({
      cancelled: false,
      values: {
        maxHours: undefined,
        maxCalendarDays: 9,
        defaultAction: "pivot",
        leadingIndicator: {
          type: "manual",
          operator: "gt",
          target: 10,
        },
      },
    });
  });

  test("returns cancelled when prompt is cancelled", async () => {
    const client = createScriptedClient([{ type: "capType", result: { kind: "cancel" } }]);

    const result = await runNewWizard(client, () => undefined);

    expect(result).toEqual({ cancelled: true });
  });
});
