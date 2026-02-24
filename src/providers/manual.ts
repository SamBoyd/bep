import { select, text, isCancel } from "@clack/prompts";
import { runCheckPrompt } from "../ui/checkPrompt.js";
import type {
  ManualComparisonOperator,
  ManualLeadingIndicator,
  ProviderAdapter,
  ProviderModule,
  ProviderParseResult,
  ProviderSetupAdapter,
  ProviderSetupContext,
  ProviderSetupResult,
} from "./types.js";

const BACK_VALUE = "__back__";
const DIM = "\u001b[2m";
const RESET = "\u001b[0m";

export type ManualOperatorPromptResult =
  | { kind: "value"; value: ManualComparisonOperator }
  | { kind: "back" }
  | { kind: "cancel" };

export type ManualTargetPromptResult =
  | { kind: "value"; value: number }
  | { kind: "back" }
  | { kind: "cancel" };

export type ManualSetupPromptClient = {
  promptManualOperator(params: {
    initialValue?: ManualComparisonOperator;
    allowBack: boolean;
  }): Promise<ManualOperatorPromptResult>;
  promptManualTarget(params: { initialValue?: number; allowBack: boolean }): Promise<ManualTargetPromptResult>;
};

function isManualComparisonOperator(value: unknown): value is ManualComparisonOperator {
  return value === "lt" || value === "lte" || value === "eq" || value === "gte" || value === "gt";
}

export function parseManualLeadingIndicator(input: unknown): ProviderParseResult<ManualLeadingIndicator> {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "leading_indicator must be an object." };
  }

  const candidate = input as { type?: unknown; operator?: unknown; target?: unknown };

  if (candidate.type !== "manual") {
    return { ok: false, error: 'leading_indicator.type must equal "manual".' };
  }

  if (!isManualComparisonOperator(candidate.operator)) {
    return { ok: false, error: 'leading_indicator.operator must be one of "lt", "lte", "eq", "gte", "gt".' };
  }

  if (typeof candidate.target !== "number" || !Number.isFinite(candidate.target)) {
    return { ok: false, error: "leading_indicator.target must be a finite number." };
  }

  return {
    ok: true,
    value: {
      type: "manual",
      operator: candidate.operator,
      target: candidate.target,
    },
  };
}

export function evaluateManualComparison(
  observedValue: number,
  operator: ManualComparisonOperator,
  target: number,
): boolean {
  if (operator === "lt") {
    return observedValue < target;
  }

  if (operator === "lte") {
    return observedValue <= target;
  }

  if (operator === "eq") {
    return observedValue === target;
  }

  if (operator === "gte") {
    return observedValue >= target;
  }

  return observedValue > target;
}

export function formatManualComparisonOperator(operator: ManualComparisonOperator): string {
  if (operator === "lt") {
    return "<";
  }

  if (operator === "lte") {
    return "<=";
  }

  if (operator === "eq") {
    return "=";
  }

  if (operator === "gte") {
    return ">=";
  }

  return ">";
}

export function createClackManualSetupPromptClient(): ManualSetupPromptClient {
  return {
    async promptManualOperator({ initialValue, allowBack }) {
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

    async promptManualTarget({ initialValue, allowBack }) {
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

export const manualAdapter: ProviderAdapter<ManualLeadingIndicator> = {
  type: "manual",
  parseIndicator(input) {
    return parseManualLeadingIndicator(input);
  },
  async runCheck(indicator) {
    const promptResult = await runCheckPrompt();
    if (promptResult.cancelled) {
      return { cancelled: true };
    }

    return {
      observedValue: promptResult.observedValue,
      meetsTarget: evaluateManualComparison(promptResult.observedValue, indicator.operator, indicator.target),
      notes: promptResult.notes,
    };
  },
};

function getManualSetupClient(
  ctx: ProviderSetupContext<ManualLeadingIndicator>,
): ManualSetupPromptClient {
  if (ctx.client && typeof ctx.client === "object") {
    const candidate = ctx.client as Partial<ManualSetupPromptClient>;
    if (typeof candidate.promptManualOperator === "function" && typeof candidate.promptManualTarget === "function") {
      return candidate as ManualSetupPromptClient;
    }
  }

  return createClackManualSetupPromptClient();
}

export const manualSetup: ProviderSetupAdapter<ManualLeadingIndicator> = {
  type: "manual",
  async collectNewWizardInput(ctx): Promise<ProviderSetupResult<ManualLeadingIndicator>> {
    const client = getManualSetupClient(ctx);
    let stepIndex = 0;
    const values: Partial<ManualLeadingIndicator> = {
      type: "manual",
      operator: ctx.initialValue?.operator,
      target: ctx.initialValue?.target,
    };

    while (stepIndex < 2) {
      if (stepIndex === 0) {
        const result = await client.promptManualOperator({
          initialValue: values.operator,
          allowBack: ctx.allowBack,
        });

        if (result.kind === "cancel") {
          return { kind: "cancel" };
        }

        if (result.kind === "back") {
          return { kind: "back" };
        }

        values.operator = result.value;
        stepIndex += 1;
        continue;
      }

      const result = await client.promptManualTarget({
        initialValue: values.target,
        allowBack: true,
      });

      if (result.kind === "cancel") {
        return { kind: "cancel" };
      }

      if (result.kind === "back") {
        stepIndex = Math.max(0, stepIndex - 1);
        continue;
      }

      values.target = result.value;
      stepIndex += 1;
    }

    if (!values.operator || typeof values.target !== "number") {
      return { kind: "cancel" };
    }

    return {
      kind: "value",
      value: {
        type: "manual",
        operator: values.operator,
        target: values.target,
      },
    };
  },
};

export const manualProviderModule: ProviderModule<ManualLeadingIndicator> = {
  adapter: manualAdapter,
  setup: manualSetup,
};
