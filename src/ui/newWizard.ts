import { isCancel, select, text } from "@clack/prompts";
import { listRegisteredProviderTypes, resolveProviderModule } from "../providers/registry.js";
import type { ManualSetupPromptClient, ManualOperatorPromptResult, ManualTargetPromptResult } from "../providers/manual.js";
import { createClackMixpanelSetupPromptClient } from "../providers/mixpanel.js";
import type { MixpanelSetupPromptClient } from "../providers/mixpanel.js";
import type { LeadingIndicator, LeadingIndicatorType, ManualComparisonOperator } from "../providers/types.js";

const BACK_VALUE = "__back__";
const DIM = "\u001b[2m";
const RESET = "\u001b[0m";

type OptionalNumberField = "max_hours" | "max_calendar_days";

export type CapTypePromptResult =
  | { kind: "value"; value: OptionalNumberField }
  | { kind: "back" }
  | { kind: "cancel" };

export type NumberPromptResult =
  | { kind: "value"; value: number }
  | { kind: "back" }
  | { kind: "cancel" };

export type LeadingIndicatorTypePromptResult =
  | { kind: "value"; value: LeadingIndicatorType }
  | { kind: "back" }
  | { kind: "cancel" };

export type MarkdownSectionPromptResult =
  | { kind: "value"; value: string }
  | { kind: "back" }
  | { kind: "cancel" };

export type NewWizardValues = {
  maxHours?: number;
  maxCalendarDays?: number;
  leadingIndicator: LeadingIndicator;
  primaryAssumption: string;
  rationale: string;
  validationPlan: string;
  notes: string;
};

export type NewWizardResult = { cancelled: true } | { cancelled: false; values: NewWizardValues };

export type WizardPromptClient = ManualSetupPromptClient &
  MixpanelSetupPromptClient & {
  promptCapType(params: {
    initialValue?: OptionalNumberField;
    allowBack: boolean;
  }): Promise<CapTypePromptResult>;
  promptCapValue(params: {
    field: OptionalNumberField;
    initialValue?: number;
    allowBack: boolean;
  }): Promise<NumberPromptResult>;
  promptLeadingIndicatorType(params: {
    initialValue?: LeadingIndicatorType;
    allowBack: boolean;
  }): Promise<LeadingIndicatorTypePromptResult>;
  promptPrimaryAssumption(params: { initialValue?: string; allowBack: boolean }): Promise<MarkdownSectionPromptResult>;
  promptRationale(params: { initialValue?: string; allowBack: boolean }): Promise<MarkdownSectionPromptResult>;
  promptValidationPlan(params: { initialValue?: string; allowBack: boolean }): Promise<MarkdownSectionPromptResult>;
  promptNotes(params: { initialValue?: string; allowBack: boolean }): Promise<MarkdownSectionPromptResult>;
};

type WizardLog = (message: string) => void;

const STEP_ORDER = [
  "cap_type",
  "cap_value",
  "leading_indicator_type",
  "leading_indicator_setup",
  "primary_assumption",
  "rationale",
  "validation_plan",
  "notes",
] as const;
type Step = (typeof STEP_ORDER)[number];
type StepFlowResult = { kind: "next" } | { kind: "back" } | { kind: "cancel" };
type PromptFlowResult<T> = { kind: "value"; value: T } | { kind: "back" } | { kind: "cancel" };
type StepHandlerContext = {
  client: WizardPromptClient;
  values: MutableWizardValues;
  stepIndex: number;
};
type StepHandler = (context: StepHandlerContext) => Promise<StepFlowResult>;

type MutableWizardValues = {
  capType?: OptionalNumberField;
  capValue?: number;
  leadingIndicatorType?: LeadingIndicatorType;
  leadingIndicator?: LeadingIndicator;
  primaryAssumption?: string;
  rationale?: string;
  validationPlan?: string;
  notes?: string;
};

function applyPromptResult<T>(result: PromptFlowResult<T>, onValue: (value: T) => void): StepFlowResult {
  if (result.kind === "cancel") {
    return { kind: "cancel" };
  }

  if (result.kind === "back") {
    return { kind: "back" };
  }

  onValue(result.value);
  return { kind: "next" };
}

function finalizeWizardValues(values: MutableWizardValues): NewWizardValues | null {
  if (
    !values.capType ||
    typeof values.capValue !== "number" ||
    !values.leadingIndicator ||
    !values.primaryAssumption ||
    !values.rationale ||
    !values.validationPlan ||
    values.notes === undefined
  ) {
    return null;
  }

  const maxHours = values.capType === "max_hours" ? values.capValue : undefined;
  const maxCalendarDays = values.capType === "max_calendar_days" ? values.capValue : undefined;

  return {
    maxHours,
    maxCalendarDays,
    leadingIndicator: values.leadingIndicator,
    primaryAssumption: values.primaryAssumption,
    rationale: values.rationale,
    validationPlan: values.validationPlan,
    notes: values.notes,
  };
}

const STEP_HANDLERS: Record<Step, StepHandler> = {
  async cap_type({ client, values, stepIndex }) {
    const result = await client.promptCapType({
      initialValue: values.capType,
      allowBack: stepIndex > 0,
    });

    return applyPromptResult(result, (value) => {
      const previousCapType = values.capType;
      values.capType = value;
      if (previousCapType !== value) {
        values.capValue = undefined;
      }
    });
  },

  async cap_value({ client, values, stepIndex }) {
    if (!values.capType) {
      return { kind: "cancel" };
    }

    const result = await client.promptCapValue({
      field: values.capType,
      initialValue: values.capValue,
      allowBack: stepIndex > 0,
    });

    return applyPromptResult(result, (value) => {
      values.capValue = value;
    });
  },

  async leading_indicator_type({ client, values, stepIndex }) {
    const result = await client.promptLeadingIndicatorType({
      initialValue: values.leadingIndicatorType,
      allowBack: stepIndex > 0,
    });

    return applyPromptResult(result, (value) => {
      if (values.leadingIndicatorType !== value) {
        values.leadingIndicator = undefined;
      }
      values.leadingIndicatorType = value;
    });
  },

  async leading_indicator_setup({ client, values, stepIndex }) {
    if (!values.leadingIndicatorType) {
      return { kind: "cancel" };
    }

    const module = resolveProviderModule(values.leadingIndicatorType);
    if (!module || !module.setup) {
      return { kind: "cancel" };
    }

    const setupResult = await module.setup.collectNewWizardInput({
      allowBack: stepIndex > 0,
      initialValue:
        values.leadingIndicator && values.leadingIndicator.type === values.leadingIndicatorType
          ? values.leadingIndicator
          : undefined,
      client,
    });

    return applyPromptResult(setupResult, (value) => {
      values.leadingIndicator = value;
    });
  },

  async primary_assumption({ client, values, stepIndex }) {
    const result = await client.promptPrimaryAssumption({
      initialValue: values.primaryAssumption,
      allowBack: stepIndex > 0,
    });

    return applyPromptResult(result, (value) => {
      values.primaryAssumption = value;
    });
  },

  async rationale({ client, values, stepIndex }) {
    const result = await client.promptRationale({
      initialValue: values.rationale,
      allowBack: stepIndex > 0,
    });

    return applyPromptResult(result, (value) => {
      values.rationale = value;
    });
  },

  async validation_plan({ client, values, stepIndex }) {
    const result = await client.promptValidationPlan({
      initialValue: values.validationPlan,
      allowBack: stepIndex > 0,
    });

    return applyPromptResult(result, (value) => {
      values.validationPlan = value;
    });
  },

  async notes({ client, values, stepIndex }) {
    const result = await client.promptNotes({
      initialValue: values.notes,
      allowBack: stepIndex > 0,
    });

    return applyPromptResult(result, (value) => {
      values.notes = value;
    });
  },
};

export async function runNewWizard(
  client: WizardPromptClient = createClackPromptClient(),
  log: WizardLog = console.log,
): Promise<NewWizardResult> {
  let stepIndex = 0;
  const values: MutableWizardValues = {};

  while (stepIndex < STEP_ORDER.length) {
    const step: Step = STEP_ORDER[stepIndex];
    const handler = STEP_HANDLERS[step];
    if (!handler) {
      throw new Error(`No wizard step handler registered for '${step}'.`);
    }

    const flow = await handler({ client, values, stepIndex });
    if (flow.kind === "cancel") {
      return { cancelled: true };
    }

    if (flow.kind === "back") {
      stepIndex = Math.max(0, stepIndex - 1);
      continue;
    }

    stepIndex += 1;
  }

  const finalizedValues = finalizeWizardValues(values);
  if (!finalizedValues) {
    return { cancelled: true };
  }

  return {
    cancelled: false,
    values: finalizedValues,
  };
}

export function createClackPromptClient(): WizardPromptClient {
  const mixpanelPromptClient = createClackMixpanelSetupPromptClient();

  return {
    async promptCapType({ initialValue, allowBack }) {
      const options: Array<{ label: string; value: OptionalNumberField | typeof BACK_VALUE }> = [
        { label: "Cap by hours", value: "max_hours" },
        { label: "Cap by calendar days", value: "max_calendar_days" },
      ];

      if (allowBack) {
        options.unshift({ label: "Back", value: BACK_VALUE });
      }

      const value = await select({
        message: "Choose your exposure cap type",
        options,
        initialValue,
      });

      if (isCancel(value)) {
        return { kind: "cancel" };
      }

      if (value === BACK_VALUE) {
        return { kind: "back" };
      }

      return { kind: "value", value };
    },

    async promptCapValue({ field, initialValue, allowBack }) {
      const label = field === "max_hours" ? "Max hours" : "Max calendar days";
      const backHint = allowBack ? ` ${DIM}(type b to go back)${RESET}` : "";

      const value = await text({
        message: `${label} (required).${backHint}`,
        initialValue: typeof initialValue === "number" ? String(initialValue) : undefined,
        validate(rawValue) {
          const trimmed = rawValue.trim();
          if (allowBack && trimmed.toLowerCase() === "b") {
            return;
          }

          if (trimmed.length === 0) {
            return "Enter a positive number.";
          }

          const parsed = Number(trimmed);
          if (!Number.isFinite(parsed) || parsed <= 0) {
            return "Enter a positive number.";
          }
        },
      });

      if (isCancel(value)) {
        return { kind: "cancel" };
      }

      const trimmed = value.trim();
      if (allowBack && trimmed.toLowerCase() === "b") {
        return { kind: "back" };
      }

      return { kind: "value", value: Number(trimmed) };
    },

    async promptLeadingIndicatorType({ initialValue, allowBack }) {
      const options: Array<{ label: string; value: LeadingIndicatorType | typeof BACK_VALUE }> = listRegisteredProviderTypes()
        .map((type) => ({ label: type, value: type as LeadingIndicatorType }));

      if (allowBack) {
        options.unshift({ label: "Back", value: BACK_VALUE });
      }

      const value = await select({
        message: "Leading indicator provider type",
        options,
        initialValue,
      });

      if (isCancel(value)) {
        return { kind: "cancel" };
      }

      if (value === BACK_VALUE) {
        return { kind: "back" };
      }

      return { kind: "value", value };
    },

    async promptManualOperator({ initialValue, allowBack }): Promise<ManualOperatorPromptResult> {
      const options: Array<{ label: string; value: ManualComparisonOperator | typeof BACK_VALUE }> = [
        { label: "lt (less than)", value: "lt" },
        { label: "lte (less than or equal)", value: "lte" },
        { label: "eq (equal)", value: "eq" },
        { label: "gte (greater than or equal)", value: "gte" },
        { label: "gt (greater than)", value: "gt" },
      ];

      if (allowBack) {
        options.unshift({ label: "Back", value: BACK_VALUE });
      }

      const value = await select({
        message: "Leading indicator comparison operator",
        options,
        initialValue,
      });

      if (isCancel(value)) {
        return { kind: "cancel" };
      }

      if (value === BACK_VALUE) {
        return { kind: "back" };
      }

      return { kind: "value", value };
    },

    async promptManualTarget({ initialValue, allowBack }): Promise<ManualTargetPromptResult> {
      const backHint = allowBack ? ` ${DIM}(type b to go back)${RESET}` : "";
      const value = await text({
        message: `Leading indicator numeric target (required).${backHint}`,
        initialValue: typeof initialValue === "number" ? String(initialValue) : undefined,
        validate(rawValue) {
          const trimmed = rawValue.trim();
          if (allowBack && trimmed.toLowerCase() === "b") {
            return;
          }

          if (trimmed.length === 0 || !Number.isFinite(Number(trimmed))) {
            return "Enter a valid number.";
          }
        },
      });

      if (isCancel(value)) {
        return { kind: "cancel" };
      }

      const trimmed = value.trim();
      if (allowBack && trimmed.toLowerCase() === "b") {
        return { kind: "back" };
      }

      return { kind: "value", value: Number(trimmed) };
    },

    async promptMixpanelProjectId({ initialValue, allowBack }) {
      return mixpanelPromptClient.promptMixpanelProjectId({ initialValue, allowBack });
    },

    async promptMixpanelWorkspaceId({ initialValue, allowBack }) {
      return mixpanelPromptClient.promptMixpanelWorkspaceId({ initialValue, allowBack });
    },

    async promptMixpanelBookmarkId({ initialValue, allowBack }) {
      return mixpanelPromptClient.promptMixpanelBookmarkId({ initialValue, allowBack });
    },

    async promptMixpanelOperator({ initialValue, allowBack }) {
      return mixpanelPromptClient.promptMixpanelOperator({ initialValue, allowBack });
    },

    async promptMixpanelTarget({ initialValue, allowBack }) {
      return mixpanelPromptClient.promptMixpanelTarget({ initialValue, allowBack });
    },

    async promptPrimaryAssumption({ initialValue, allowBack }): Promise<MarkdownSectionPromptResult> {
      const backHint = allowBack ? ` ${DIM}(type b to go back)${RESET}` : "";
      const value = await text({
        message: `Primary assumption (required).${backHint}`,
        initialValue,
        validate(rawValue) {
          const trimmed = rawValue.trim();
          if (allowBack && trimmed.toLowerCase() === "b") {
            return;
          }

          if (trimmed.length === 0) {
            return "Enter a value.";
          }
        },
      });

      if (isCancel(value)) {
        return { kind: "cancel" };
      }

      const trimmed = value.trim();
      if (allowBack && trimmed.toLowerCase() === "b") {
        return { kind: "back" };
      }

      return { kind: "value", value: trimmed };
    },

    async promptRationale({ initialValue, allowBack }): Promise<MarkdownSectionPromptResult> {
      const backHint = allowBack ? ` ${DIM}(type b to go back)${RESET}` : "";
      const value = await text({
        message: `Rationale (required).${backHint}`,
        initialValue,
        validate(rawValue) {
          const trimmed = rawValue.trim();
          if (allowBack && trimmed.toLowerCase() === "b") {
            return;
          }

          if (trimmed.length === 0) {
            return "Enter a value.";
          }
        },
      });

      if (isCancel(value)) {
        return { kind: "cancel" };
      }

      const trimmed = value.trim();
      if (allowBack && trimmed.toLowerCase() === "b") {
        return { kind: "back" };
      }

      return { kind: "value", value: trimmed };
    },

    async promptValidationPlan({ initialValue, allowBack }): Promise<MarkdownSectionPromptResult> {
      const backHint = allowBack ? ` ${DIM}(type b to go back)${RESET}` : "";
      const value = await text({
        message: `Validation plan (required).${backHint}`,
        initialValue,
        validate(rawValue) {
          const trimmed = rawValue.trim();
          if (allowBack && trimmed.toLowerCase() === "b") {
            return;
          }

          if (trimmed.length === 0) {
            return "Enter a value.";
          }
        },
      });

      if (isCancel(value)) {
        return { kind: "cancel" };
      }

      const trimmed = value.trim();
      if (allowBack && trimmed.toLowerCase() === "b") {
        return { kind: "back" };
      }

      return { kind: "value", value: trimmed };
    },

    async promptNotes({ initialValue, allowBack }): Promise<MarkdownSectionPromptResult> {
      const backHint = allowBack ? ` ${DIM}(type b to go back)${RESET}` : "";
      const value = await text({
        message: `Notes (optional).${backHint}`,
        initialValue,
        validate(rawValue) {
          const trimmed = (rawValue || '').trim();
          if (allowBack && trimmed.toLowerCase() === "b") {
            return;
          }

          return undefined;
        },
      });

      if (isCancel(value)) {
        return { kind: "cancel" };
      }

      const trimmed = (value || '').trim();
      if (allowBack && trimmed.toLowerCase() === "b") {
        return { kind: "back" };
      }

      return { kind: "value", value: trimmed };
    },
  };
}
