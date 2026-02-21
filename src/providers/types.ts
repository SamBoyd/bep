export type LeadingIndicatorType = "manual" | "mixpanel";

export type ManualComparisonOperator = "lt" | "lte" | "eq" | "gte" | "gt";

export type ManualLeadingIndicator = {
  type: "manual";
  operator: ManualComparisonOperator;
  target: number;
};

export type MixpanelLeadingIndicator = {
  type: "mixpanel";
  project_id: string;
  workspace_id: string;
  bookmark_id: string;
  operator: ManualComparisonOperator;
  target: number;
};

export type LeadingIndicator = ManualLeadingIndicator | MixpanelLeadingIndicator;

export type CheckRunContext = {
  rootDir: string;
  betId: string;
  nowIso: string;
};

export type CheckRunResult = {
  observedValue: number;
  meetsTarget: boolean;
  notes?: string;
  meta?: Record<string, unknown>;
};

export type ProviderParseResult<TIndicator> = { ok: true; value: TIndicator } | { ok: false; error: string };

export type ProviderSetupResult<TIndicator> =
  | { kind: "value"; value: TIndicator }
  | { kind: "back" }
  | { kind: "cancel" };

export type ProviderSetupContext<TIndicator extends LeadingIndicator> = {
  allowBack: boolean;
  initialValue?: TIndicator;
  client: unknown;
};

export interface ProviderAdapter<TIndicator extends LeadingIndicator = LeadingIndicator> {
  readonly type: TIndicator["type"];
  parseIndicator(input: unknown): ProviderParseResult<TIndicator>;
  runCheck(indicator: TIndicator, ctx: CheckRunContext): Promise<CheckRunResult | { cancelled: true }>;
}

export interface ProviderSetupAdapter<TIndicator extends LeadingIndicator = LeadingIndicator> {
  readonly type: TIndicator["type"];
  collectNewWizardInput(ctx: ProviderSetupContext<TIndicator>): Promise<ProviderSetupResult<TIndicator>>;
}

export type ProviderModule<TIndicator extends LeadingIndicator = LeadingIndicator> = {
  adapter: ProviderAdapter<TIndicator>;
  setup?: ProviderSetupAdapter<TIndicator>;
};

export type ProviderRegistry = Record<string, ProviderModule<any>>;
