import { useEffect, useMemo, useState } from "react";
import { listRegisteredProviderTypes } from "../../../providers/registry.js";
import type { LeadingIndicatorType } from "../../../providers/types.js";
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
import type { NewWizardResult } from "../../newWizardPromptTypes.js";

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

function isProviderType(value: string): value is LeadingIndicatorType {
  return value === "manual" || value === "mixpanel";
}

function buildPrompt(step: WizardStepId, draft: WizardDraftValues, allowBack: boolean): WizardPrompt {
  const withBack = <T extends string>(options: Array<{ label: string; value: T }>) => {
    const base = options.map((option) => ({ ...option }));
    if (allowBack) {
      base.unshift({ label: "Back", value: BACK_OPTION });
    }
    return base;
  };

  const requiredText = (
    title: string,
    initialValue: string | undefined,
    emptyMessage: string,
    helpText?: string,
  ): TextPromptRequest => ({
    title,
    initialValue,
    allowBack,
    helpText,
    validate(rawValue) {
      if (rawValue.trim().length === 0) {
        return emptyMessage;
      }
      return undefined;
    },
  });

  if (step === "cap_type") {
    return {
      title: "Choose your exposure cap type",
      allowBack,
      initialValue: draft.capType,
      options: withBack([
        { label: "Cap by hours", value: "max_hours" },
        { label: "Cap by calendar days", value: "max_calendar_days" },
      ]),
    };
  }

  if (step === "cap_value") {
    return {
      title: `${draft.capType === "max_calendar_days" ? "Max calendar days" : "Max hours"} (required).`,
      initialValue: typeof draft.capValue === "number" ? String(draft.capValue) : undefined,
      allowBack,
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
      allowBack,
      initialValue: draft.leadingIndicatorType,
      options: withBack(
        listRegisteredProviderTypes()
          .filter(isProviderType)
          .map((type) => ({ label: type, value: type })),
      ),
    };
  }

  if (step === "manual_operator") {
    return {
      title: "Leading indicator comparison operator",
      allowBack,
      initialValue: draft.manualOperator,
      options: withBack([
        { label: "lt (less than)", value: "lt" },
        { label: "lte (less than or equal)", value: "lte" },
        { label: "eq (equal)", value: "eq" },
        { label: "gte (greater than or equal)", value: "gte" },
        { label: "gt (greater than)", value: "gt" },
      ]),
    };
  }

  if (step === "manual_target") {
    return {
      title: "Leading indicator numeric target (required).",
      initialValue: typeof draft.manualTarget === "number" ? String(draft.manualTarget) : undefined,
      allowBack,
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
      allowBack,
      initialValue: draft.mixpanelOperator,
      options: withBack([
        { label: "lt (less than)", value: "lt" },
        { label: "lte (less than or equal)", value: "lte" },
        { label: "eq (equal)", value: "eq" },
        { label: "gte (greater than or equal)", value: "gte" },
        { label: "gt (greater than)", value: "gt" },
      ]),
    };
  }

  if (step === "mixpanel_target") {
    return {
      title: "Mixpanel target value (required).",
      initialValue: typeof draft.mixpanelTarget === "number" ? String(draft.mixpanelTarget) : undefined,
      allowBack,
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
    return requiredText("Primary assumption (required).", draft.primaryAssumption, "Enter a value.");
  }

  if (step === "rationale") {
    return requiredText("Rationale (required).", draft.rationale, "Enter a value.");
  }

  if (step === "validation_plan") {
    return requiredText("Validation plan (required).", draft.validationPlan, "Enter a value.");
  }

  return {
    title: "Notes (optional).",
    initialValue: draft.notes,
    allowBack,
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

export function useWizardState(onComplete: (result: NewWizardResult) => void): {
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
  const allowBack = safeStepIndex > 0;
  const prompt = useMemo(() => buildPrompt(step, draft, allowBack), [step, draft, allowBack]);

  useEffect(() => {
    if (safeStepIndex !== stepIndex) {
      setStepIndex(safeStepIndex);
    }
  }, [safeStepIndex, stepIndex]);

  useEffect(() => {
    setUiState(buildUiState(prompt));
  }, [step]);

  const completeIfDone = (nextDraft: WizardDraftValues, nextStepIndex: number) => {
    if (nextStepIndex < steps.length) {
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

    let nextDraft!: WizardDraftValues;
    const nextStep = safeStepIndex + 1;
    setDraft((previous) => {
      nextDraft = applySelectStepValue(previous, step, selectedValue);
      return nextDraft;
    });

    if (!completeIfDone(nextDraft, nextStep)) {
      setStepIndex(nextStep);
    }
  };

  const submitText = () => {
    if ("options" in prompt) {
      return;
    }

    const submission = classifyTextSubmission(uiState.textValue, {
      allowBack,
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

    let nextDraft!: WizardDraftValues;
    const nextStep = safeStepIndex + 1;
    setDraft((previous) => {
      nextDraft = applyTextStepValue(previous, step, submission.value);
      return nextDraft;
    });

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
