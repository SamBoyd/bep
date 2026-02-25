import {
  applySelectStepValue,
  applyTextStepValue,
  createInitialWizardDraft,
  finalizeWizardDraft,
  getWizardSteps,
} from "../../src/ui/ink/newWizard/flow.js";

describe("new wizard flow helpers", () => {
  test("uses a natural base step order", () => {
    expect(getWizardSteps()).toEqual([
      "bet_name",
      "primary_assumption",
      "validation_plan",
      "leading_indicator_type",
      "cap_type",
      "cap_value",
      "notes",
    ]);
  });

  test("inserts manual provider steps when manual is selected", () => {
    expect(getWizardSteps("manual")).toEqual([
      "bet_name",
      "primary_assumption",
      "validation_plan",
      "leading_indicator_type",
      "manual_operator",
      "manual_target",
      "cap_type",
      "cap_value",
      "notes",
    ]);
  });

  test("inserts mixpanel provider steps when mixpanel is selected", () => {
    expect(getWizardSteps("mixpanel")).toEqual([
      "bet_name",
      "primary_assumption",
      "validation_plan",
      "leading_indicator_type",
      "mixpanel_workspace_id",
      "mixpanel_project_id",
      "mixpanel_bookmark_id",
      "mixpanel_operator",
      "mixpanel_target",
      "cap_type",
      "cap_value",
      "notes",
    ]);
  });

  test("changing cap type clears cap value", () => {
    const withCap = applySelectStepValue(
      applyTextStepValue(
        applySelectStepValue(createInitialWizardDraft(), "cap_type", "max_hours"),
        "cap_value",
        "12",
      ),
      "cap_type",
      "max_calendar_days",
    );

    expect(withCap.capType).toBe("max_calendar_days");
    expect(withCap.capValue).toBeUndefined();
  });

  test("normalizes bet name text input", () => {
    const draft = applyTextStepValue(createInitialWizardDraft(), "bet_name", " Landing Page Refresh ");
    expect(draft.betName).toBe("landing_page_refresh");
  });

  test("changing provider type clears incompatible provider fields", () => {
    let draft = createInitialWizardDraft();
    draft = applySelectStepValue(draft, "leading_indicator_type", "manual");
    draft = applySelectStepValue(draft, "manual_operator", "gte");
    draft = applyTextStepValue(draft, "manual_target", "20");
    draft = applySelectStepValue(draft, "leading_indicator_type", "mixpanel");

    expect(draft.manualOperator).toBeUndefined();
    expect(draft.manualTarget).toBeUndefined();
    expect(draft.leadingIndicatorType).toBe("mixpanel");
  });

  test("finalizes manual flow values", () => {
    let draft = createInitialWizardDraft();
    draft = applyTextStepValue(draft, "bet_name", "Manual Bet");
    draft = applySelectStepValue(draft, "cap_type", "max_hours");
    draft = applyTextStepValue(draft, "cap_value", "8");
    draft = applySelectStepValue(draft, "leading_indicator_type", "manual");
    draft = applySelectStepValue(draft, "manual_operator", "gte");
    draft = applyTextStepValue(draft, "manual_target", "100");
    draft = applyTextStepValue(draft, "primary_assumption", "Assumption");
    draft = applyTextStepValue(draft, "validation_plan", "Plan");
    draft = applyTextStepValue(draft, "notes", "");

    expect(finalizeWizardDraft(draft)).toEqual({
      betName: "manual_bet",
      maxHours: 8,
      maxCalendarDays: undefined,
      leadingIndicator: {
        type: "manual",
        operator: "gte",
        target: 100,
      },
      primaryAssumption: "Assumption",
      validationPlan: "Plan",
      notes: "",
    });
  });

  test("finalizes mixpanel flow values", () => {
    let draft = createInitialWizardDraft();
    draft = applyTextStepValue(draft, "bet_name", "Mixpanel Bet");
    draft = applySelectStepValue(draft, "cap_type", "max_calendar_days");
    draft = applyTextStepValue(draft, "cap_value", "14");
    draft = applySelectStepValue(draft, "leading_indicator_type", "mixpanel");
    draft = applyTextStepValue(draft, "mixpanel_project_id", "3989556");
    draft = applyTextStepValue(draft, "mixpanel_workspace_id", "4485331");
    draft = applyTextStepValue(draft, "mixpanel_bookmark_id", "88319528");
    draft = applySelectStepValue(draft, "mixpanel_operator", "gte");
    draft = applyTextStepValue(draft, "mixpanel_target", "100");
    draft = applyTextStepValue(draft, "primary_assumption", "Assumption");
    draft = applyTextStepValue(draft, "validation_plan", "Plan");
    draft = applyTextStepValue(draft, "notes", "");

    expect(finalizeWizardDraft(draft)).toEqual({
      betName: "mixpanel_bet",
      maxHours: undefined,
      maxCalendarDays: 14,
      leadingIndicator: {
        type: "mixpanel",
        project_id: "3989556",
        workspace_id: "4485331",
        bookmark_id: "88319528",
        operator: "gte",
        target: 100,
      },
      primaryAssumption: "Assumption",
      validationPlan: "Plan",
      notes: "",
    });
  });
});
