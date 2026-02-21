import {
  type CapTypePromptResult,
  runNewWizard,
  type ActionPromptResult,
  type LeadingIndicatorTypePromptResult,
  type MarkdownSectionPromptResult,
  type NumberPromptResult,
  type WizardPromptClient,
} from "../../src/ui/newWizard";
import type { ManualOperatorPromptResult, ManualTargetPromptResult } from "../../src/providers/manual";
import type { ManualComparisonOperator } from "../../src/providers/types";

type ScriptedStep =
  | { type: "capType"; result: CapTypePromptResult }
  | { type: "capValue"; result: NumberPromptResult }
  | { type: "action"; result: ActionPromptResult }
  | { type: "leadingIndicatorType"; result: LeadingIndicatorTypePromptResult }
  | { type: "manualOperator"; result: ManualOperatorPromptResult }
  | { type: "manualTarget"; result: ManualTargetPromptResult }
  | { type: "mixpanelProjectId"; result: { kind: "value"; value: string } | { kind: "back" } | { kind: "cancel" } }
  | { type: "mixpanelWorkspaceId"; result: { kind: "value"; value: string } | { kind: "back" } | { kind: "cancel" } }
  | { type: "mixpanelBookmarkId"; result: { kind: "value"; value: string } | { kind: "back" } | { kind: "cancel" } }
  | {
      type: "mixpanelOperator";
      result: { kind: "value"; value: ManualComparisonOperator } | { kind: "back" } | { kind: "cancel" };
    }
  | { type: "mixpanelTarget"; result: { kind: "value"; value: number } | { kind: "back" } | { kind: "cancel" } }
  | { type: "primaryAssumption"; result: MarkdownSectionPromptResult }
  | { type: "rationale"; result: MarkdownSectionPromptResult }
  | { type: "validationPlan"; result: MarkdownSectionPromptResult }
  | { type: "notes"; result: MarkdownSectionPromptResult };

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
    async promptMixpanelProjectId() {
      const next = steps.shift();
      if (!next || next.type !== "mixpanelProjectId") {
        throw new Error("Unexpected mixpanel project id prompt");
      }
      return next.result;
    },
    async promptMixpanelWorkspaceId() {
      const next = steps.shift();
      if (!next || next.type !== "mixpanelWorkspaceId") {
        throw new Error("Unexpected mixpanel workspace id prompt");
      }
      return next.result;
    },
    async promptMixpanelBookmarkId() {
      const next = steps.shift();
      if (!next || next.type !== "mixpanelBookmarkId") {
        throw new Error("Unexpected mixpanel bookmark id prompt");
      }
      return next.result;
    },
    async promptMixpanelOperator() {
      const next = steps.shift();
      if (!next || next.type !== "mixpanelOperator") {
        throw new Error("Unexpected mixpanel operator prompt");
      }
      return next.result;
    },
    async promptMixpanelTarget() {
      const next = steps.shift();
      if (!next || next.type !== "mixpanelTarget") {
        throw new Error("Unexpected mixpanel target prompt");
      }
      return next.result;
    },
    async promptPrimaryAssumption() {
      const next = steps.shift();
      if (!next || next.type !== "primaryAssumption") {
        throw new Error("Unexpected primary assumption prompt");
      }
      return next.result;
    },
    async promptRationale() {
      const next = steps.shift();
      if (!next || next.type !== "rationale") {
        throw new Error("Unexpected rationale prompt");
      }
      return next.result;
    },
    async promptValidationPlan() {
      const next = steps.shift();
      if (!next || next.type !== "validationPlan") {
        throw new Error("Unexpected validation plan prompt");
      }
      return next.result;
    },
    async promptNotes() {
      const next = steps.shift();
      if (!next || next.type !== "notes") {
        throw new Error("Unexpected notes prompt");
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
      { type: "primaryAssumption", result: { kind: "value", value: "Traffic from SEO can convert to trials." } },
      { type: "rationale", result: { kind: "value", value: "SEO channel has compounding returns and low CAC." } },
      { type: "validationPlan", result: { kind: "value", value: "Measure trial signups from organic for 2 weeks." } },
      { type: "notes", result: { kind: "value", value: "Coordinate with content launch timeline." } },
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
        primaryAssumption: "Traffic from SEO can convert to trials.",
        rationale: "SEO channel has compounding returns and low CAC.",
        validationPlan: "Measure trial signups from organic for 2 weeks.",
        notes: "Coordinate with content launch timeline.",
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
      { type: "primaryAssumption", result: { kind: "value", value: "Users will finish onboarding with fewer drop-offs." } },
      { type: "rationale", result: { kind: "value", value: "Current onboarding completion is below target." } },
      { type: "validationPlan", result: { kind: "value", value: "Track onboarding completion rate weekly." } },
      { type: "notes", result: { kind: "value", value: "" } },
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
        primaryAssumption: "Users will finish onboarding with fewer drop-offs.",
        rationale: "Current onboarding completion is below target.",
        validationPlan: "Track onboarding completion rate weekly.",
        notes: "",
      },
    });
  });

  test("returns cancelled when prompt is cancelled", async () => {
    const client = createScriptedClient([{ type: "capType", result: { kind: "cancel" } }]);

    const result = await runNewWizard(client, () => undefined);

    expect(result).toEqual({ cancelled: true });
  });

  test("collects mixpanel setup values when mixpanel provider is selected", async () => {
    const client = createScriptedClient([
      { type: "capType", result: { kind: "value", value: "max_hours" } },
      { type: "capValue", result: { kind: "value", value: 8 } },
      { type: "action", result: { kind: "value", value: "narrow" } },
      { type: "leadingIndicatorType", result: { kind: "value", value: "mixpanel" } },
      { type: "mixpanelProjectId", result: { kind: "value", value: "3989556" } },
      { type: "mixpanelWorkspaceId", result: { kind: "value", value: "4485331" } },
      { type: "mixpanelBookmarkId", result: { kind: "value", value: "88319528" } },
      { type: "mixpanelOperator", result: { kind: "value", value: "gte" } },
      { type: "mixpanelTarget", result: { kind: "value", value: 100 } },
      { type: "primaryAssumption", result: { kind: "value", value: "Activation will improve with onboarding updates." } },
      { type: "rationale", result: { kind: "value", value: "Current activation is below baseline." } },
      { type: "validationPlan", result: { kind: "value", value: "Use saved insight for 14-day rolling activation." } },
      { type: "notes", result: { kind: "value", value: "" } },
    ]);

    const result = await runNewWizard(client, () => undefined);

    expect(result).toEqual({
      cancelled: false,
      values: {
        maxHours: 8,
        maxCalendarDays: undefined,
        defaultAction: "narrow",
        leadingIndicator: {
          type: "mixpanel",
          project_id: "3989556",
          workspace_id: "4485331",
          bookmark_id: "88319528",
          operator: "gte",
          target: 100,
        },
        primaryAssumption: "Activation will improve with onboarding updates.",
        rationale: "Current activation is below baseline.",
        validationPlan: "Use saved insight for 14-day rolling activation.",
        notes: "",
      },
    });
  });
});
