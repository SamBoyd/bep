import { Buffer } from "node:buffer";

import { evaluateManualComparison } from "./manual.js";
import { getMixpanelServiceAccountCreds, readProviderConfig } from "./config.js";
import type {
  ManualComparisonOperator,
  MixpanelLeadingIndicator,
  ProviderAdapter,
  ProviderModule,
  ProviderParseResult,
} from "./types.js";

const MIXPANEL_REPORT_ENDPOINT = "https://mixpanel.com/api/query/insights";

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

export const mixpanelProviderModule: ProviderModule<MixpanelLeadingIndicator> = {
  adapter: mixpanelAdapter,
};
