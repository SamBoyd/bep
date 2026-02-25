import { useEffect, useMemo, useState } from "react";
import { listRegisteredProviderTypes } from "../../../providers/registry.js";
import type { LeadingIndicatorType } from "../../../providers/types.js";
import { normalizeBetName } from "../../newBetName.js";
import type { NewWizardOptions, NewWizardResult } from "../../newWizardPromptTypes.js";
import {
  applySelectStepValue,
  applyTextStepValue,
  createInitialWizardDraft,
  finalizeWizardDraft,
  getWizardSteps,
  type WizardDraftValues,
  type WizardStepId,
} from "./flow.js";
import { classifyTextSubmission, getInitialSelectIndex } from "./promptUtils.js";
import type { SelectPromptRequest, TextPromptRequest } from "./types.js";

const BACK_OPTION = "__back__";
const MIXPANEL_URL_HINT =
  "Values come from report URL: /project/<PROJECT_ID>/view/<WORKSPACE_ID>/...#...report-<BOOKMARK_ID>.";

export type WizardPrompt = SelectPromptRequest | TextPromptRequest;

export type WizardUiState = {
  textValue: string;
  selectIndex: number;
  error?: string;
};

export type WizardStateActions = {
  goBack: () => void;
  submitSelect: (value: string) => void;
  submitText: () => void;
  cancel: () => void;
  setUiState: React.Dispatch<React.SetStateAction<WizardUiState>>;
};

export const WIZARD_GUIDANCE_COPY = {
  primary_assumption: {
    title: "What must be true for this bet to work?",
    helpText:
      "Write the core assumption you are betting on. Focus on one claim that could be proven wrong.",
    placeholder:
      "Example: Users who start onboarding from the pricing page convert better because they already understand the value.",
  },
  validation_plan: {
    title: "How will you validate whether the bet worked?",
    helpText:
      "Describe the metric(s), comparison, and decision rule you will use. Include what outcome would count as success or failure.",
    placeholder:
      "Example: Compare signup-to-activation rate for users exposed to variant B vs control for 14 days; consider the bet validated if activation improves by >=10% with no drop in trial starts.",
  },
} as const;

function isProviderType(value: string): value is LeadingIndicatorType {
  return value === "manual" || value === "mixpanel";
}

function buildPrompt(
  step: WizardStepId,
  draft: WizardDraftValues,
  options: NewWizardOptions,
): WizardPrompt {
  const requiredText = (
    title: string,
    initialValue: string | undefined,
    emptyMessage: string,
    helpText?: string,
    placeholder?: string,
  ): TextPromptRequest => ({
    title,
    initialValue,
    helpText,
    placeholder,
    validate(rawValue) {
      if (rawValue.trim().length === 0) {
        return emptyMessage;
      }
      return undefined;
    },
  });

  if (step === "bet_name") {
    return {
      title: "Bet name (required).",
      initialValue: draft.betName ?? options.initialBetName,
      validate(rawValue) {
        const normalizedName = normalizeBetName(rawValue);
        if (normalizedName.length === 0) {
          return "Enter a bet name.";
        }

        return options.validateBetName(normalizedName);
      },
    };
  }

  if (step === "cap_type") {
    return {
      title: "Choose your exposure cap type",
      initialValue: draft.capType,
      options: [
        { label: "Cap by hours", value: "max_hours" },
        { label: "Cap by calendar days", value: "max_calendar_days" },
      ],
    };
  }

  if (step === "cap_value") {
    return {
      title: `${draft.capType === "max_calendar_days" ? "Max calendar days" : "Max hours"} (required).`,
      initialValue: typeof draft.capValue === "number" ? String(draft.capValue) : undefined,
      validate(rawValue) {
        const trimmed = rawValue.trim();
        if (trimmed.length === 0) {
          return "Enter a positive number.";
        }

        const parsed = Number(trimmed);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          return "Enter a positive number.";
        }

        return undefined;
      },
    };
  }

  if (step === "leading_indicator_type") {
    return {
      title: "Leading indicator provider type",
      initialValue: draft.leadingIndicatorType,
      options: listRegisteredProviderTypes()
          .filter(isProviderType)
          .map((type) => ({ label: type, value: type })),
    };
  }

  if (step === "manual_operator") {
    return {
      title: "Leading indicator comparison operator",
      initialValue: draft.manualOperator,
      options: [
        { label: "lt (less than)", value: "lt" },
        { label: "lte (less than or equal)", value: "lte" },
        { label: "eq (equal)", value: "eq" },
        { label: "gte (greater than or equal)", value: "gte" },
        { label: "gt (greater than)", value: "gt" },
      ],
    };
  }

  if (step === "manual_target") {
    return {
      title: "Leading indicator numeric target (required).",
      initialValue: typeof draft.manualTarget === "number" ? String(draft.manualTarget) : undefined,
      validate(rawValue) {
        const trimmed = rawValue.trim();
        if (trimmed.length === 0 || !Number.isFinite(Number(trimmed))) {
          return "Enter a valid number.";
        }
        return undefined;
      },
    };
  }

  if (step === "mixpanel_project_id") {
    return requiredText("Mixpanel project id (required).", draft.mixpanelProjectId, "Enter a project id.", MIXPANEL_URL_HINT);
  }

  if (step === "mixpanel_workspace_id") {
    return requiredText(
      "Mixpanel workspace id (required).",
      draft.mixpanelWorkspaceId,
      "Enter a workspace id.",
      MIXPANEL_URL_HINT,
    );
  }

  if (step === "mixpanel_bookmark_id") {
    return requiredText(
      "Mixpanel bookmark id (required).",
      draft.mixpanelBookmarkId,
      "Enter a bookmark id.",
      MIXPANEL_URL_HINT,
    );
  }

  if (step === "mixpanel_operator") {
    return {
      title: "Mixpanel comparison operator",
      initialValue: draft.mixpanelOperator,
      options: [
        { label: "lt (less than)", value: "lt" },
        { label: "lte (less than or equal)", value: "lte" },
        { label: "eq (equal)", value: "eq" },
        { label: "gte (greater than or equal)", value: "gte" },
        { label: "gt (greater than)", value: "gt" },
      ],
    };
  }

  if (step === "mixpanel_target") {
    return {
      title: "Mixpanel target value (required).",
      initialValue: typeof draft.mixpanelTarget === "number" ? String(draft.mixpanelTarget) : undefined,
      validate(rawValue) {
        const trimmed = rawValue.trim();
        if (trimmed.length === 0 || !Number.isFinite(Number(trimmed))) {
          return "Enter a valid number.";
        }
        return undefined;
      },
    };
  }

  if (step === "primary_assumption") {
    return requiredText(
      WIZARD_GUIDANCE_COPY.primary_assumption.title,
      draft.primaryAssumption,
      "Enter a value.",
      WIZARD_GUIDANCE_COPY.primary_assumption.helpText,
      WIZARD_GUIDANCE_COPY.primary_assumption.placeholder,
    );
  }

  if (step === "validation_plan") {
    return requiredText(
      WIZARD_GUIDANCE_COPY.validation_plan.title,
      draft.validationPlan,
      "Enter a value.",
      WIZARD_GUIDANCE_COPY.validation_plan.helpText,
      WIZARD_GUIDANCE_COPY.validation_plan.placeholder,
    );
  }

  return {
    title: "Notes (optional).",
    initialValue: draft.notes,
    optional: true,
    validate: () => undefined,
  };
}

function buildUiState(prompt: WizardPrompt): WizardUiState {
  if ("options" in prompt) {
    return {
      textValue: "",
      selectIndex: getInitialSelectIndex(prompt.options, prompt.initialValue),
      error: undefined,
    };
  }

  return {
    textValue: prompt.initialValue ?? "",
    selectIndex: 0,
    error: undefined,
  };
}

export function useWizardState(
  onComplete: (result: NewWizardResult) => void,
  options: NewWizardOptions,
): {
  prompt: WizardPrompt;
  uiState: WizardUiState;
  actions: WizardStateActions;
} {
  const [draft, setDraft] = useState<WizardDraftValues>(() => createInitialWizardDraft());
  const [stepIndex, setStepIndex] = useState(0);
  const [uiState, setUiState] = useState<WizardUiState>({ textValue: "", selectIndex: 0 });

  const steps = useMemo(() => getWizardSteps(draft.leadingIndicatorType), [draft.leadingIndicatorType]);
  const safeStepIndex = Math.min(stepIndex, Math.max(0, steps.length - 1));
  const step = steps[safeStepIndex] ?? steps[0];
  const prompt = useMemo(() => buildPrompt(step, draft, options), [step, draft, options]);

  useEffect(() => {
    if (safeStepIndex !== stepIndex) {
      setStepIndex(safeStepIndex);
    }
  }, [safeStepIndex, stepIndex]);

  useEffect(() => {
    setUiState(buildUiState(prompt));
  }, [step]);

  const completeIfDone = (nextDraft: WizardDraftValues, nextStepIndex: number) => {
    const nextSteps = getWizardSteps(nextDraft.leadingIndicatorType);
    if (nextStepIndex < nextSteps.length) {
      return false;
    }

    const finalized = finalizeWizardDraft(nextDraft);
    onComplete(finalized ? { cancelled: false, values: finalized } : { cancelled: true });
    return true;
  };

  const goBack = () => {
    setUiState((previous) => ({ ...previous, error: undefined }));
    setStepIndex((previous) => Math.max(0, previous - 1));
  };

  const submitSelect = (selectedValue: string) => {
    if (selectedValue === BACK_OPTION) {
      goBack();
      return;
    }

    const nextStep = safeStepIndex + 1;
    const nextDraft = applySelectStepValue(draft, step, selectedValue);
    setDraft(nextDraft);

    if (!completeIfDone(nextDraft, nextStep)) {
      setStepIndex(nextStep);
    }
  };

  const submitText = () => {
    if ("options" in prompt) {
      return;
    }

    const submission = classifyTextSubmission(uiState.textValue, {
      validate: prompt.validate,
    });

    if (submission.kind === "invalid") {
      setUiState((previous) => ({ ...previous, error: submission.message }));
      return;
    }

    if (submission.kind === "back") {
      goBack();
      return;
    }

    const nextStep = safeStepIndex + 1;
    const nextDraft = applyTextStepValue(draft, step, submission.value);
    setDraft(nextDraft);

    if (!completeIfDone(nextDraft, nextStep)) {
      setStepIndex(nextStep);
    }
  };

  const cancel = () => {
    onComplete({ cancelled: true });
  };

  return {
    prompt,
    uiState,
    actions: { goBack, submitSelect, submitText, cancel, setUiState },
  };
}
