export type HookEvent = "user-prompt-submit" | "post-tool-use" | "post-tool-use-failure" | "session-end";

export type ParsedHookPayload = {
  sessionId?: string;
  prompt?: string;
  toolName?: string;
  toolInput?: string;
  toolOutput?: string;
  transcriptPath?: string;
  cwd?: string;
  raw: Record<string, unknown>;
};

export type BetCatalogEntry = {
  id: string;
  status: string;
  assumption?: string;
  rationale?: string;
  validationPlan?: string;
  notes?: string;
  summary: string;
};

export type AttributionHistoryEntry = {
  at?: string;
  event?: HookEvent | string;
  session_id?: string;
  decision?: {
    action?: string;
    bet_id?: string;
    stop_bet_id?: string;
    confidence?: number;
    reason?: string;
  };
};

export type SelectionContext = {
  event: HookEvent;
  payload: ParsedHookPayload | null;
  activeBetIds: string[];
  bets: BetCatalogEntry[];
  recentAttribution: AttributionHistoryEntry[];
};

export type SelectionDecisionAction = "start" | "stop" | "switch" | "keep" | "none";

export type SelectionDecision = {
  action: SelectionDecisionAction;
  bet_id?: string;
  stop_bet_id?: string;
  confidence: number;
  reason: string;
};

export type SelectionResult =
  | { ok: true; decision: SelectionDecision; rawText: string }
  | { ok: false; error: string; rawText?: string };

export type AppliedDecisionResult = {
  applied: boolean;
  appliedSteps: string[];
  decision: SelectionDecision;
  error?: string;
};
