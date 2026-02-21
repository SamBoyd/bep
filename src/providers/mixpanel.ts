import { Buffer } from "node:buffer";

import { isCancel, select, text } from "@clack/prompts";
import { evaluateManualComparison } from "./manual";
import { getMixpanelServiceAccountCreds, readProviderConfig } from "./config";
import type {
  ManualComparisonOperator,
  MixpanelLeadingIndicator,
  ProviderAdapter,
  ProviderModule,
  ProviderParseResult,
  ProviderSetupAdapter,
  ProviderSetupContext,
  ProviderSetupResult,
} from "./types";

const BACK_VALUE = "__back__";
const DIM = "\u001b[2m";
const RESET = "\u001b[0m";
const MIXPANEL_REPORT_ENDPOINT = "https://mixpanel.com/api/query/insights";
const MIXPANEL_URL_HINT =
  "Values come from report URL: /project/<PROJECT_ID>/view/<WORKSPACE_ID>/...#...report-<BOOKMARK_ID>.";

type MixpanelProjectPromptResult =
  | { kind: "value"; value: string }
  | { kind: "back" }
  | { kind: "cancel" };

type MixpanelWorkspacePromptResult =
  | { kind: "value"; value: string }
  | { kind: "back" }
  | { kind: "cancel" };

type MixpanelBookmarkPromptResult =
  | { kind: "value"; value: string }
  | { kind: "back" }
  | { kind: "cancel" };

type MixpanelOperatorPromptResult =
  | { kind: "value"; value: ManualComparisonOperator }
  | { kind: "back" }
  | { kind: "cancel" };

type MixpanelTargetPromptResult =
  | { kind: "value"; value: number }
  | { kind: "back" }
  | { kind: "cancel" };

export type MixpanelSetupPromptClient = {
  promptMixpanelProjectId(params: { initialValue?: string; allowBack: boolean }): Promise<MixpanelProjectPromptResult>;
  promptMixpanelWorkspaceId(params: {
    initialValue?: string;
    allowBack: boolean;
  }): Promise<MixpanelWorkspacePromptResult>;
  promptMixpanelBookmarkId(params: {
    initialValue?: string;
    allowBack: boolean;
  }): Promise<MixpanelBookmarkPromptResult>;
  promptMixpanelOperator(params: {
    initialValue?: ManualComparisonOperator;
    allowBack: boolean;
  }): Promise<MixpanelOperatorPromptResult>;
  promptMixpanelTarget(params: { initialValue?: number; allowBack: boolean }): Promise<MixpanelTargetPromptResult>;
};

function isManualComparisonOperator(value: unknown): value is ManualComparisonOperator {
  return value === "lt" || value === "lte" || value === "eq" || value === "gte" || value === "gt";
}

export function parseMixpanelLeadingIndicator(input: unknown): ProviderParseResult<MixpanelLeadingIndicator> {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "leading_indicator must be an object." };
  }

  const candidate = input as {
    type?: unknown;
    project_id?: unknown;
    workspace_id?: unknown;
    bookmark_id?: unknown;
    operator?: unknown;
    target?: unknown;
  };

  if (candidate.type !== "mixpanel") {
    return { ok: false, error: 'leading_indicator.type must equal "mixpanel".' };
  }

  if (typeof candidate.project_id !== "string" || candidate.project_id.trim().length === 0) {
    return { ok: false, error: "leading_indicator.project_id must be a non-empty string." };
  }

  if (typeof candidate.workspace_id !== "string" || candidate.workspace_id.trim().length === 0) {
    return { ok: false, error: "leading_indicator.workspace_id must be a non-empty string." };
  }

  if (typeof candidate.bookmark_id !== "string" || candidate.bookmark_id.trim().length === 0) {
    return { ok: false, error: "leading_indicator.bookmark_id must be a non-empty string." };
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
      type: "mixpanel",
      project_id: candidate.project_id.trim(),
      workspace_id: candidate.workspace_id.trim(),
      bookmark_id: candidate.bookmark_id.trim(),
      operator: candidate.operator,
      target: candidate.target,
    },
  };
}

function getMixpanelSetupClient(ctx: ProviderSetupContext<MixpanelLeadingIndicator>): MixpanelSetupPromptClient {
  if (ctx.client && typeof ctx.client === "object") {
    const candidate = ctx.client as Partial<MixpanelSetupPromptClient>;
    if (
      typeof candidate.promptMixpanelProjectId === "function" &&
      typeof candidate.promptMixpanelWorkspaceId === "function" &&
      typeof candidate.promptMixpanelBookmarkId === "function" &&
      typeof candidate.promptMixpanelOperator === "function" &&
      typeof candidate.promptMixpanelTarget === "function"
    ) {
      return candidate as MixpanelSetupPromptClient;
    }
  }

  return createClackMixpanelSetupPromptClient();
}

export function createClackMixpanelSetupPromptClient(): MixpanelSetupPromptClient {
  return {
    async promptMixpanelProjectId({ initialValue, allowBack }) {
      const backHint = allowBack ? ` ${DIM}(type b to go back)${RESET}` : "";
      const value = await text({
        message: `Mixpanel project id (required). ${MIXPANEL_URL_HINT}${backHint}`,
        initialValue,
        validate(rawValue) {
          const trimmed = rawValue.trim();
          if (allowBack && trimmed.toLowerCase() === "b") {
            return;
          }

          if (trimmed.length === 0) {
            return "Enter a project id.";
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

    async promptMixpanelWorkspaceId({ initialValue, allowBack }) {
      const backHint = allowBack ? ` ${DIM}(type b to go back)${RESET}` : "";
      const value = await text({
        message: `Mixpanel workspace id (required). ${MIXPANEL_URL_HINT}${backHint}`,
        initialValue,
        validate(rawValue) {
          const trimmed = rawValue.trim();
          if (allowBack && trimmed.toLowerCase() === "b") {
            return;
          }

          if (trimmed.length === 0) {
            return "Enter a workspace id.";
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

    async promptMixpanelBookmarkId({ initialValue, allowBack }) {
      const backHint = allowBack ? ` ${DIM}(type b to go back)${RESET}` : "";
      const value = await text({
        message: `Mixpanel bookmark id (required). ${MIXPANEL_URL_HINT}${backHint}`,
        initialValue,
        validate(rawValue) {
          const trimmed = rawValue.trim();
          if (allowBack && trimmed.toLowerCase() === "b") {
            return;
          }

          if (trimmed.length === 0) {
            return "Enter a bookmark id.";
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

    async promptMixpanelOperator({ initialValue, allowBack }) {
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
        message: "Mixpanel comparison operator",
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

    async promptMixpanelTarget({ initialValue, allowBack }) {
      const backHint = allowBack ? ` ${DIM}(type b to go back)${RESET}` : "";
      const value = await text({
        message: `Mixpanel target value (required).${backHint}`,
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

function collectNumericLeaves(value: unknown): number[] {
  const numbers: number[] = [];
  const stack: unknown[] = [value];

  while (stack.length > 0) {
    const current = stack.pop();
    if (typeof current === "number" && Number.isFinite(current)) {
      numbers.push(current);
      continue;
    }

    if (!current || typeof current !== "object") {
      continue;
    }

    for (const nested of Object.values(current)) {
      stack.push(nested);
    }
  }

  return numbers;
}

function parseObservedValue(payload: unknown): { value: number | null; seriesNumericLeafCount: number | null } {
  if (!payload || typeof payload !== "object") {
    return { value: null, seriesNumericLeafCount: null };
  }

  const candidate = payload as { value?: unknown; result?: unknown; series?: unknown };
  if (typeof candidate.value === "number" && Number.isFinite(candidate.value)) {
    return { value: candidate.value, seriesNumericLeafCount: null };
  }

  if (candidate.result && typeof candidate.result === "object") {
    const maybeResult = candidate.result as { value?: unknown };
    if (typeof maybeResult.value === "number" && Number.isFinite(maybeResult.value)) {
      return { value: maybeResult.value, seriesNumericLeafCount: null };
    }
  }

  if (candidate.series && typeof candidate.series === "object") {
    const numericLeaves = collectNumericLeaves(candidate.series);
    if (numericLeaves.length === 1) {
      return { value: numericLeaves[0], seriesNumericLeafCount: 1 };
    }

    return {
      value: null,
      seriesNumericLeafCount: numericLeaves.length,
    };
  }

  return { value: null, seriesNumericLeafCount: null };
}

export const mixpanelAdapter: ProviderAdapter<MixpanelLeadingIndicator> = {
  type: "mixpanel",
  parseIndicator(input) {
    return parseMixpanelLeadingIndicator(input);
  },
  async runCheck(indicator, ctx) {
    const configResult = await readProviderConfig(ctx.rootDir);
    if (!configResult.ok) {
      throw new Error(configResult.error);
    }

    const credsResult = getMixpanelServiceAccountCreds(configResult.value);
    if (!credsResult.ok) {
      throw new Error(credsResult.error);
    }

    const params = new URLSearchParams({
      project_id: indicator.project_id,
      workspace_id: indicator.workspace_id,
      bookmark_id: indicator.bookmark_id,
    });
    const url = `${MIXPANEL_REPORT_ENDPOINT}?${params.toString()}`;
    const encodedCreds = Buffer.from(credsResult.value, "utf8").toString("base64");

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          authorization: `Basic ${encodedCreds}`,
          accept: "application/json",
        },
      });
    } catch (error) {
      throw new Error(`Failed to query Mixpanel insights API: ${(error as Error).message}`);
    }

    if (!response.ok) {
      throw new Error(`Mixpanel insights API returned ${response.status} ${response.statusText}.`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error(`Failed to parse Mixpanel response JSON: ${(error as Error).message}`);
    }

    const observed = parseObservedValue(payload);
    if (observed.value === null) {
      if (observed.seriesNumericLeafCount !== null) {
        throw new Error(
          observed.seriesNumericLeafCount === 0
            ? "Mixpanel response series must contain exactly one numeric value; found 0."
            : `Mixpanel response series must contain exactly one numeric value; found ${observed.seriesNumericLeafCount}. Use a single-value insight/report.`,
        );
      }

      throw new Error("Mixpanel response did not include a numeric value field.");
    }

    const observedValue = observed.value;

    return {
      observedValue,
      meetsTarget: evaluateManualComparison(observedValue, indicator.operator, indicator.target),
      meta: {
        provider: "mixpanel",
        project_id: indicator.project_id,
        workspace_id: indicator.workspace_id,
        bookmark_id: indicator.bookmark_id,
      },
    };
  },
};

export const mixpanelSetup: ProviderSetupAdapter<MixpanelLeadingIndicator> = {
  type: "mixpanel",
  async collectNewWizardInput(ctx): Promise<ProviderSetupResult<MixpanelLeadingIndicator>> {
    const client = getMixpanelSetupClient(ctx);
    let stepIndex = 0;
    const values: Partial<MixpanelLeadingIndicator> = {
      type: "mixpanel",
      project_id: ctx.initialValue?.project_id,
      workspace_id: ctx.initialValue?.workspace_id,
      bookmark_id: ctx.initialValue?.bookmark_id,
      operator: ctx.initialValue?.operator,
      target: ctx.initialValue?.target,
    };

    while (stepIndex < 5) {
      if (stepIndex === 0) {
        const result = await client.promptMixpanelProjectId({
          initialValue: values.project_id,
          allowBack: ctx.allowBack,
        });

        if (result.kind === "cancel") {
          return { kind: "cancel" };
        }
        if (result.kind === "back") {
          return { kind: "back" };
        }

        values.project_id = result.value;
        stepIndex += 1;
        continue;
      }

      if (stepIndex === 1) {
        const result = await client.promptMixpanelWorkspaceId({
          initialValue: values.workspace_id,
          allowBack: true,
        });

        if (result.kind === "cancel") {
          return { kind: "cancel" };
        }
        if (result.kind === "back") {
          stepIndex = Math.max(0, stepIndex - 1);
          continue;
        }

        values.workspace_id = result.value;
        stepIndex += 1;
        continue;
      }

      if (stepIndex === 2) {
        const result = await client.promptMixpanelBookmarkId({
          initialValue: values.bookmark_id,
          allowBack: true,
        });

        if (result.kind === "cancel") {
          return { kind: "cancel" };
        }
        if (result.kind === "back") {
          stepIndex = Math.max(0, stepIndex - 1);
          continue;
        }

        values.bookmark_id = result.value;
        stepIndex += 1;
        continue;
      }

      if (stepIndex === 3) {
        const result = await client.promptMixpanelOperator({
          initialValue: values.operator,
          allowBack: true,
        });

        if (result.kind === "cancel") {
          return { kind: "cancel" };
        }
        if (result.kind === "back") {
          stepIndex = Math.max(0, stepIndex - 1);
          continue;
        }

        values.operator = result.value;
        stepIndex += 1;
        continue;
      }

      const result = await client.promptMixpanelTarget({
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

    if (
      !values.project_id ||
      !values.workspace_id ||
      !values.bookmark_id ||
      !values.operator ||
      typeof values.target !== "number"
    ) {
      return { kind: "cancel" };
    }

    return {
      kind: "value",
      value: {
        type: "mixpanel",
        project_id: values.project_id,
        workspace_id: values.workspace_id,
        bookmark_id: values.bookmark_id,
        operator: values.operator,
        target: values.target,
      },
    };
  },
};

export const mixpanelProviderModule: ProviderModule<MixpanelLeadingIndicator> = {
  adapter: mixpanelAdapter,
  setup: mixpanelSetup,
};
