import { isCancel, select, text } from "@clack/prompts";
import type { ManualComparisonOperator } from "../bep/checkInput";
import type { DefaultAction } from "../bep/template";

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

export type ActionPromptResult =
  | { kind: "value"; value: DefaultAction }
  | { kind: "back" }
  | { kind: "cancel" };

export type LeadingIndicatorTargetPromptResult =
  | { kind: "value"; value: number }
  | { kind: "back" }
  | { kind: "cancel" };

export type LeadingIndicatorOperatorPromptResult =
  | { kind: "value"; value: ManualComparisonOperator }
  | { kind: "back" }
  | { kind: "cancel" };

export type NewWizardValues = {
  maxHours?: number;
  maxCalendarDays?: number;
  defaultAction: DefaultAction;
  leadingIndicatorOperator: ManualComparisonOperator;
  leadingIndicatorTarget: number;
};

export type NewWizardResult =
  | { cancelled: true }
  | { cancelled: false; values: NewWizardValues };

export type WizardPromptClient = {
  promptCapType(params: {
    initialValue?: OptionalNumberField;
    allowBack: boolean;
  }): Promise<CapTypePromptResult>;
  promptCapValue(params: {
    field: OptionalNumberField;
    initialValue?: number;
    allowBack: boolean;
  }): Promise<NumberPromptResult>;
  promptDefaultAction(params: { initialValue?: DefaultAction; allowBack: boolean }): Promise<ActionPromptResult>;
  promptLeadingIndicatorOperator(params: {
    initialValue?: ManualComparisonOperator;
    allowBack: boolean;
  }): Promise<LeadingIndicatorOperatorPromptResult>;
  promptLeadingIndicatorTarget(params: {
    initialValue?: number;
    allowBack: boolean;
  }): Promise<LeadingIndicatorTargetPromptResult>;
};

type WizardLog = (message: string) => void;

const STEP_ORDER = [
  "cap_type",
  "cap_value",
  "default_action",
  "leading_indicator_operator",
  "leading_indicator_target",
] as const;
type Step = (typeof STEP_ORDER)[number];

type MutableWizardValues = {
  capType?: OptionalNumberField;
  capValue?: number;
  defaultAction?: DefaultAction;
  leadingIndicatorOperator?: ManualComparisonOperator;
  leadingIndicatorTarget?: number;
};

function formatChosenValues(values: MutableWizardValues): string[] {
  const lines: string[] = [];

  if (values.capType) {
    lines.push(`- cap_type: ${values.capType}`);
  }

  if (typeof values.capValue === "number" && values.capType) {
    lines.push(`- ${values.capType}: ${values.capValue}`);
  }

  if (values.defaultAction) {
    lines.push(`- default_action: ${values.defaultAction}`);
  }

  if (values.leadingIndicatorOperator) {
    lines.push(`- leading_indicator.operator: ${values.leadingIndicatorOperator}`);
  }

  if (typeof values.leadingIndicatorTarget === "number") {
    lines.push(`- leading_indicator.target: ${values.leadingIndicatorTarget}`);
  }

  return lines;
}

export async function runNewWizard(
  client: WizardPromptClient = createClackPromptClient(),
  log: WizardLog = console.log,
): Promise<NewWizardResult> {
  let stepIndex = 0;
  const values: MutableWizardValues = {};
  let hasPrompted = false;

  while (stepIndex < STEP_ORDER.length) {
    if (hasPrompted) {
      log("");
    }
    hasPrompted = true;

    const step: Step = STEP_ORDER[stepIndex];

    if (step === "cap_type") {
      const result = await client.promptCapType({
        initialValue: values.capType,
        allowBack: stepIndex > 0,
      });

      if (result.kind === "cancel") {
        return { cancelled: true };
      }

      if (result.kind === "back") {
        stepIndex = Math.max(0, stepIndex - 1);
        continue;
      }

      const previousCapType = values.capType;
      values.capType = result.value;
      if (previousCapType !== result.value) {
        values.capValue = undefined;
      }
      stepIndex += 1;
      continue;
    }

    if (step === "cap_value") {
      if (!values.capType) {
        return { cancelled: true };
      }

      const result = await client.promptCapValue({
        field: values.capType,
        initialValue: values.capValue,
        allowBack: stepIndex > 0,
      });

      if (result.kind === "cancel") {
        return { cancelled: true };
      }

      if (result.kind === "back") {
        stepIndex = Math.max(0, stepIndex - 1);
        continue;
      }

      values.capValue = result.value;
      stepIndex += 1;
      continue;
    }

    if (step === "default_action") {
      const result = await client.promptDefaultAction({
        initialValue: values.defaultAction,
        allowBack: stepIndex > 0,
      });

      if (result.kind === "cancel") {
        return { cancelled: true };
      }

      if (result.kind === "back") {
        stepIndex = Math.max(0, stepIndex - 1);
        continue;
      }

      values.defaultAction = result.value;
      stepIndex += 1;
      continue;
    }

    if (step === "leading_indicator_operator") {
      const result = await client.promptLeadingIndicatorOperator({
        initialValue: values.leadingIndicatorOperator,
        allowBack: stepIndex > 0,
      });

      if (result.kind === "cancel") {
        return { cancelled: true };
      }

      if (result.kind === "back") {
        stepIndex = Math.max(0, stepIndex - 1);
        continue;
      }

      values.leadingIndicatorOperator = result.value;
      stepIndex += 1;
      continue;
    }

    const result = await client.promptLeadingIndicatorTarget({
      initialValue: values.leadingIndicatorTarget,
      allowBack: stepIndex > 0,
    });

    if (result.kind === "cancel") {
      return { cancelled: true };
    }

    if (result.kind === "back") {
      stepIndex = Math.max(0, stepIndex - 1);
      continue;
    }

    values.leadingIndicatorTarget = result.value;
    stepIndex += 1;
  }

  if (
    !values.defaultAction ||
    !values.capType ||
    typeof values.capValue !== "number" ||
    !values.leadingIndicatorOperator ||
    typeof values.leadingIndicatorTarget !== "number"
  ) {
    return { cancelled: true };
  }

  const maxHours = values.capType === "max_hours" ? values.capValue : undefined;
  const maxCalendarDays = values.capType === "max_calendar_days" ? values.capValue : undefined;

  return {
    cancelled: false,
    values: {
      maxHours,
      maxCalendarDays,
      defaultAction: values.defaultAction,
      leadingIndicatorOperator: values.leadingIndicatorOperator,
      leadingIndicatorTarget: values.leadingIndicatorTarget,
    },
  };
}

export function createClackPromptClient(): WizardPromptClient {
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

    async promptDefaultAction({ initialValue, allowBack }) {
      const options: Array<{ label: string; value: DefaultAction | typeof BACK_VALUE }> = [
        { label: "Kill", value: "kill" },
        { label: "Narrow", value: "narrow" },
        { label: "Pivot", value: "pivot" },
        { label: "Extend", value: "extend" },
      ];

      if (allowBack) {
        options.unshift({ label: "Back", value: BACK_VALUE });
      }

      const value = await select({
        message: "Default action if validation fails",
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

    async promptLeadingIndicatorOperator({ initialValue, allowBack }) {
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

    async promptLeadingIndicatorTarget({ initialValue, allowBack }) {
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
  };
}
