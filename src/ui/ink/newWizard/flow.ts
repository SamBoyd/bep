import type {
  LeadingIndicatorType,
  ManualComparisonOperator,
  ManualLeadingIndicator,
  MixpanelLeadingIndicator,
} from "../../../providers/types.js";
import type { NewWizardValues, OptionalNumberField } from "../../newWizardPromptTypes.js";

export type WizardStepId =
  | "cap_type"
  | "cap_value"
  | "leading_indicator_type"
  | "manual_operator"
  | "manual_target"
  | "mixpanel_project_id"
  | "mixpanel_workspace_id"
  | "mixpanel_bookmark_id"
  | "mixpanel_operator"
  | "mixpanel_target"
  | "primary_assumption"
  | "rationale"
  | "validation_plan"
  | "notes";

export type WizardDraftValues = {
  capType?: OptionalNumberField;
  capValue?: number;
  leadingIndicatorType?: LeadingIndicatorType;
  manualOperator?: ManualComparisonOperator;
  manualTarget?: number;
  mixpanelProjectId?: string;
  mixpanelWorkspaceId?: string;
  mixpanelBookmarkId?: string;
  mixpanelOperator?: ManualComparisonOperator;
  mixpanelTarget?: number;
  primaryAssumption?: string;
  rationale?: string;
  validationPlan?: string;
  notes?: string;
};

export function createInitialWizardDraft(): WizardDraftValues {
  return {};
}

export function getWizardSteps(providerType?: LeadingIndicatorType): WizardStepId[] {
  const steps: WizardStepId[] = ["cap_type", "cap_value", "leading_indicator_type"];

  if (providerType === "manual") {
    steps.push("manual_operator", "manual_target");
  } else if (providerType === "mixpanel") {
    steps.push("mixpanel_project_id", "mixpanel_workspace_id", "mixpanel_bookmark_id", "mixpanel_operator", "mixpanel_target");
  }

  steps.push("primary_assumption", "rationale", "validation_plan", "notes");
  return steps;
}

export function applySelectStepValue(
  draft: WizardDraftValues,
  step: WizardStepId,
  value: string,
): WizardDraftValues {
  if (step === "cap_type") {
    const nextCapType = value as OptionalNumberField;
    return {
      ...draft,
      capType: nextCapType,
      capValue: draft.capType !== nextCapType ? undefined : draft.capValue,
    };
  }

  if (step === "leading_indicator_type") {
    const nextProviderType = value as LeadingIndicatorType;
    if (draft.leadingIndicatorType === nextProviderType) {
      return { ...draft, leadingIndicatorType: nextProviderType };
    }

    return {
      ...draft,
      leadingIndicatorType: nextProviderType,
      manualOperator: undefined,
      manualTarget: undefined,
      mixpanelProjectId: undefined,
      mixpanelWorkspaceId: undefined,
      mixpanelBookmarkId: undefined,
      mixpanelOperator: undefined,
      mixpanelTarget: undefined,
    };
  }

  if (step === "manual_operator") {
    return { ...draft, manualOperator: value as ManualComparisonOperator };
  }

  if (step === "mixpanel_operator") {
    return { ...draft, mixpanelOperator: value as ManualComparisonOperator };
  }

  return draft;
}

export function applyTextStepValue(
  draft: WizardDraftValues,
  step: WizardStepId,
  rawValue: string,
): WizardDraftValues {
  if (step === "cap_value") {
    return { ...draft, capValue: Number(rawValue.trim()) };
  }

  if (step === "manual_target") {
    return { ...draft, manualTarget: Number(rawValue.trim()) };
  }

  if (step === "mixpanel_target") {
    return { ...draft, mixpanelTarget: Number(rawValue.trim()) };
  }

  if (step === "mixpanel_project_id") {
    return { ...draft, mixpanelProjectId: rawValue.trim() };
  }

  if (step === "mixpanel_workspace_id") {
    return { ...draft, mixpanelWorkspaceId: rawValue.trim() };
  }

  if (step === "mixpanel_bookmark_id") {
    return { ...draft, mixpanelBookmarkId: rawValue.trim() };
  }

  if (step === "primary_assumption") {
    return { ...draft, primaryAssumption: rawValue.trim() };
  }

  if (step === "rationale") {
    return { ...draft, rationale: rawValue.trim() };
  }

  if (step === "validation_plan") {
    return { ...draft, validationPlan: rawValue.trim() };
  }

  if (step === "notes") {
    return { ...draft, notes: rawValue.trim() };
  }

  return draft;
}

export function buildLeadingIndicatorFromDraft(
  draft: WizardDraftValues,
): ManualLeadingIndicator | MixpanelLeadingIndicator | null {
  if (draft.leadingIndicatorType === "manual") {
    if (!draft.manualOperator || typeof draft.manualTarget !== "number") {
      return null;
    }

    return {
      type: "manual",
      operator: draft.manualOperator,
      target: draft.manualTarget,
    };
  }

  if (draft.leadingIndicatorType === "mixpanel") {
    if (
      !draft.mixpanelProjectId ||
      !draft.mixpanelWorkspaceId ||
      !draft.mixpanelBookmarkId ||
      !draft.mixpanelOperator ||
      typeof draft.mixpanelTarget !== "number"
    ) {
      return null;
    }

    return {
      type: "mixpanel",
      project_id: draft.mixpanelProjectId,
      workspace_id: draft.mixpanelWorkspaceId,
      bookmark_id: draft.mixpanelBookmarkId,
      operator: draft.mixpanelOperator,
      target: draft.mixpanelTarget,
    };
  }

  return null;
}

export function finalizeWizardDraft(draft: WizardDraftValues): NewWizardValues | null {
  if (!draft.capType || typeof draft.capValue !== "number") {
    return null;
  }

  const leadingIndicator = buildLeadingIndicatorFromDraft(draft);
  if (!leadingIndicator) {
    return null;
  }

  if (!draft.primaryAssumption || !draft.rationale || !draft.validationPlan || draft.notes === undefined) {
    return null;
  }

  return {
    maxHours: draft.capType === "max_hours" ? draft.capValue : undefined,
    maxCalendarDays: draft.capType === "max_calendar_days" ? draft.capValue : undefined,
    leadingIndicator,
    primaryAssumption: draft.primaryAssumption,
    rationale: draft.rationale,
    validationPlan: draft.validationPlan,
    notes: draft.notes,
  };
}
