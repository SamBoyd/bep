import {
  applySelectStepValue,
  applyTextStepValue,
  createInitialWizardDraft,
  finalizeWizardDraft,
  getWizardSteps,
} from "../../src/ui/ink/newWizard/flow.js";

describe("new wizard flow helpers", () => {
  test("inserts manual provider steps when manual is selected", () => {
    expect(getWizardSteps("manual")).toContain("manual_operator");
    expect(getWizardSteps("manual")).toContain("manual_target");
    expect(getWizardSteps("manual")).not.toContain("mixpanel_project_id");
  });

  test("inserts mixpanel provider steps when mixpanel is selected", () => {
    expect(getWizardSteps("mixpanel")).toContain("mixpanel_project_id");
    expect(getWizardSteps("mixpanel")).toContain("mixpanel_target");
    expect(getWizardSteps("mixpanel")).not.toContain("manual_operator");
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
    draft = applySelectStepValue(draft, "cap_type", "max_hours");
    draft = applyTextStepValue(draft, "cap_value", "8");
    draft = applySelectStepValue(draft, "leading_indicator_type", "manual");
    draft = applySelectStepValue(draft, "manual_operator", "gte");
    draft = applyTextStepValue(draft, "manual_target", "100");
    draft = applyTextStepValue(draft, "primary_assumption", "Assumption");
    draft = applyTextStepValue(draft, "rationale", "Rationale");
    draft = applyTextStepValue(draft, "validation_plan", "Plan");
    draft = applyTextStepValue(draft, "notes", "");

    expect(finalizeWizardDraft(draft)).toEqual({
      maxHours: 8,
      maxCalendarDays: undefined,
      leadingIndicator: {
        type: "manual",
        operator: "gte",
        target: 100,
      },
      primaryAssumption: "Assumption",
      rationale: "Rationale",
      validationPlan: "Plan",
      notes: "",
    });
  });

  test("finalizes mixpanel flow values", () => {
    let draft = createInitialWizardDraft();
    draft = applySelectStepValue(draft, "cap_type", "max_calendar_days");
    draft = applyTextStepValue(draft, "cap_value", "14");
    draft = applySelectStepValue(draft, "leading_indicator_type", "mixpanel");
    draft = applyTextStepValue(draft, "mixpanel_project_id", "3989556");
    draft = applyTextStepValue(draft, "mixpanel_workspace_id", "4485331");
    draft = applyTextStepValue(draft, "mixpanel_bookmark_id", "88319528");
    draft = applySelectStepValue(draft, "mixpanel_operator", "gte");
    draft = applyTextStepValue(draft, "mixpanel_target", "100");
    draft = applyTextStepValue(draft, "primary_assumption", "Assumption");
    draft = applyTextStepValue(draft, "rationale", "Rationale");
    draft = applyTextStepValue(draft, "validation_plan", "Plan");
    draft = applyTextStepValue(draft, "notes", "");

    expect(finalizeWizardDraft(draft)).toEqual({
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
      rationale: "Rationale",
      validationPlan: "Plan",
      notes: "",
    });
  });
});
