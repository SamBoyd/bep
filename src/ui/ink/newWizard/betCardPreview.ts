import { formatManualComparisonOperator } from "../../../providers/manual.js";
import type { LeadingIndicatorType, ManualComparisonOperator } from "../../../providers/types.js";
import type { WizardDraftValues, WizardStepId } from "./flow.js";
import type { WizardPrompt, WizardUiState } from "./useWizardState.js";

const EMPTY_VALUE = "—";
const EMPTY_TEXT = "Not entered yet";

type ProviderConfigField = {
  label: string;
  value: string;
  empty: boolean;
};

export type BetCardProviderItem = {
  type: string;
  label: string;
  selected: boolean;
};

export type BetCardPreviewModel = {
  betName: { label: string; value: string; empty: boolean };
  primaryAssumption: { value: string; empty: boolean };
  validationPlan: { value: string; empty: boolean };
  providers: BetCardProviderItem[];
  selectedProviderType?: LeadingIndicatorType;
  providerConfigTitle: string;
  providerConfigFields: ProviderConfigField[];
  validationRuleSummary: string;
  capSummary: string;
};

type EffectivePreviewState = {
  betName?: string;
  primaryAssumption?: string;
  validationPlan?: string;
  leadingIndicatorType?: LeadingIndicatorType;
  capType?: WizardDraftValues["capType"];
  capValueText?: string;
  manualOperator?: ManualComparisonOperator;
  manualTargetText?: string;
  mixpanelProjectId?: string;
  mixpanelWorkspaceId?: string;
  mixpanelBookmarkId?: string;
  mixpanelOperator?: ManualComparisonOperator;
  mixpanelTargetText?: string;
};

function isSelectPrompt(prompt: WizardPrompt): prompt is Extract<WizardPrompt, { options: unknown[] }> {
  return "options" in prompt;
}

function getHighlightedSelectValue(prompt: WizardPrompt, uiState: WizardUiState): string | undefined {
  if (!isSelectPrompt(prompt)) {
    return undefined;
  }

  const option = prompt.options[uiState.selectIndex];
  return option?.value;
}

function normalizePreviewText(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value.length > 0 ? value : undefined;
}

function buildEffectivePreviewState(
  draft: WizardDraftValues,
  step: WizardStepId,
  prompt: WizardPrompt,
  uiState: WizardUiState,
): EffectivePreviewState {
  const highlightedValue = getHighlightedSelectValue(prompt, uiState);
  const effective: EffectivePreviewState = {
    betName: draft.betName,
    primaryAssumption: draft.primaryAssumption,
    validationPlan: draft.validationPlan,
    leadingIndicatorType: draft.leadingIndicatorType,
    capType: draft.capType,
    capValueText: draft.capValue === undefined ? undefined : String(draft.capValue),
    manualOperator: draft.manualOperator,
    manualTargetText: draft.manualTarget === undefined ? undefined : String(draft.manualTarget),
    mixpanelProjectId: draft.mixpanelProjectId,
    mixpanelWorkspaceId: draft.mixpanelWorkspaceId,
    mixpanelBookmarkId: draft.mixpanelBookmarkId,
    mixpanelOperator: draft.mixpanelOperator,
    mixpanelTargetText: draft.mixpanelTarget === undefined ? undefined : String(draft.mixpanelTarget),
  };

  if (step === "bet_name" && !isSelectPrompt(prompt)) {
    effective.betName = normalizePreviewText(uiState.textValue);
  } else if (step === "primary_assumption" && !isSelectPrompt(prompt)) {
    effective.primaryAssumption = normalizePreviewText(uiState.textValue);
  } else if (step === "validation_plan" && !isSelectPrompt(prompt)) {
    effective.validationPlan = normalizePreviewText(uiState.textValue);
  } else if (step === "leading_indicator_type" && highlightedValue) {
    if (highlightedValue === "manual" || highlightedValue === "mixpanel") {
      effective.leadingIndicatorType = highlightedValue;
    }
  } else if (step === "cap_type" && highlightedValue) {
    if (highlightedValue === "max_hours" || highlightedValue === "max_calendar_days") {
      effective.capType = highlightedValue;
    }
  } else if (step === "cap_value" && !isSelectPrompt(prompt)) {
    effective.capValueText = normalizePreviewText(uiState.textValue);
  } else if (step === "manual_operator" && highlightedValue) {
    if (isComparisonOperator(highlightedValue)) {
      effective.manualOperator = highlightedValue;
    }
  } else if (step === "manual_target" && !isSelectPrompt(prompt)) {
    effective.manualTargetText = normalizePreviewText(uiState.textValue);
  } else if (step === "mixpanel_project_id" && !isSelectPrompt(prompt)) {
    effective.mixpanelProjectId = normalizePreviewText(uiState.textValue);
  } else if (step === "mixpanel_workspace_id" && !isSelectPrompt(prompt)) {
    effective.mixpanelWorkspaceId = normalizePreviewText(uiState.textValue);
  } else if (step === "mixpanel_bookmark_id" && !isSelectPrompt(prompt)) {
    effective.mixpanelBookmarkId = normalizePreviewText(uiState.textValue);
  } else if (step === "mixpanel_operator" && highlightedValue) {
    if (isComparisonOperator(highlightedValue)) {
      effective.mixpanelOperator = highlightedValue;
    }
  } else if (step === "mixpanel_target" && !isSelectPrompt(prompt)) {
    effective.mixpanelTargetText = normalizePreviewText(uiState.textValue);
  }

  return effective;
}

function isComparisonOperator(value: string): value is ManualComparisonOperator {
  return value === "lt" || value === "lte" || value === "eq" || value === "gte" || value === "gt";
}

function valueField(value: string | undefined): { value: string; empty: boolean } {
  if (!value) {
    return { value: EMPTY_TEXT, empty: true };
  }

  return { value, empty: false };
}

function inlineValue(value: string | undefined): string {
  return value && value.length > 0 ? value : EMPTY_VALUE;
}

function providerLabel(type: string): string {
  if (type === "mixpanel") {
    return "Mixpanel";
  }

  if (type === "manual") {
    return "Manual";
  }

  return type;
}

function buildValidationRuleSummary(effective: EffectivePreviewState): string {
  if (effective.leadingIndicatorType === "mixpanel") {
    const operator = effective.mixpanelOperator
      ? formatManualComparisonOperator(effective.mixpanelOperator)
      : EMPTY_VALUE;
    const target = inlineValue(effective.mixpanelTargetText);
    return `Mixpanel metric ${operator} ${target}`;
  }

  if (effective.leadingIndicatorType === "manual") {
    const operator = effective.manualOperator
      ? formatManualComparisonOperator(effective.manualOperator)
      : EMPTY_VALUE;
    const target = inlineValue(effective.manualTargetText);
    return `Manual observed value ${operator} ${target}`;
  }

  return "Select a provider to define validation rule";
}

function buildCapSummary(effective: EffectivePreviewState): string {
  const capValue = effective.capValueText;
  if (!effective.capType || !capValue) {
    return "Set exposure cap type and value";
  }

  return effective.capType === "max_calendar_days"
    ? `${capValue} calendar day${capValue === "1" ? "" : "s"}`
    : `${capValue} hour${capValue === "1" ? "" : "s"}`;
}

function buildProviderConfig(effective: EffectivePreviewState): {
  title: string;
  fields: ProviderConfigField[];
} {
  if (effective.leadingIndicatorType === "mixpanel") {
    return {
      title: "Mixpanel config",
      fields: [
        {
          label: "workspace id",
          ...valueField(effective.mixpanelWorkspaceId),
        },
        {
          label: "project id",
          ...valueField(effective.mixpanelProjectId),
        },
        {
          label: "bookmark id",
          ...valueField(effective.mixpanelBookmarkId),
        },
      ],
    };
  }

  if (effective.leadingIndicatorType === "manual") {
    return {
      title: "Manual config",
      fields: [
        {
          label: "operator",
          value: effective.manualOperator ? formatManualComparisonOperator(effective.manualOperator) : EMPTY_VALUE,
          empty: !effective.manualOperator,
        },
        {
          label: "target",
          value: inlineValue(effective.manualTargetText),
          empty: !effective.manualTargetText,
        },
      ],
    };
  }

  return {
    title: "Config",
    fields: [
      {
        label: "provider",
        value: "Select a provider",
        empty: true,
      },
    ],
  };
}

export function buildBetCardPreviewModel(args: {
  draft: WizardDraftValues;
  step: WizardStepId;
  prompt: WizardPrompt;
  uiState: WizardUiState;
  providerTypes: string[];
}): BetCardPreviewModel {
  const effective = buildEffectivePreviewState(args.draft, args.step, args.prompt, args.uiState);
  const providerConfig = buildProviderConfig(effective);

  return {
    betName: {
      label: "Bet name",
      ...valueField(effective.betName),
    },
    primaryAssumption: valueField(effective.primaryAssumption),
    validationPlan: valueField(effective.validationPlan),
    providers: args.providerTypes.map((type) => ({
      type,
      label: providerLabel(type),
      selected: type === effective.leadingIndicatorType,
    })),
    selectedProviderType: effective.leadingIndicatorType,
    providerConfigTitle: providerConfig.title,
    providerConfigFields: providerConfig.fields,
    validationRuleSummary: buildValidationRuleSummary(effective),
    capSummary: buildCapSummary(effective),
  };
}

