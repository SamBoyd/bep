# Claude Code Hooks Integration

This doc describes how BEP integrates with Claude Code hooks today, with a focus on **estimating token usage** for the hook-driven bet attribution selector (the `claude` subprocess).

## Scope (token usage focus)

This report covers **only** the `claude` subprocess used for bet attribution in hooks (`selectBetWithClaude`).

Important clarifications:
- `bep check` provider validations (manual, Mixpanel) **do not use an LLM** today, so they do not spend “LLM tokens”.
- Tokens are spent when hook events run attribution via the `claude` CLI (see “Claude subprocess invocation”).
- If there are **no bets** in the repo, the selector returns early and **does not call** `claude`.

## Supported hook events (Claude Code)

Hook commands are installed for these Claude Code events (see `./src/hooks/claude.ts`):
- `UserPromptSubmit` → `user-prompt-submit`
- `PostToolUse` → `post-tool-use`
- `PostToolUseFailure` → `post-tool-use-failure`
- `SessionEnd` → `session-end`

Each hook event can trigger bet attribution; the `user-prompt-submit` event is also where BEP may block the prompt when the active bet is at cap.

## Integration overview (what runs on each hook)

Call chain:
- Hook entrypoint: `./src/commands/hook.ts`
  - Reads stdin, parses payload, builds context, runs selector, optionally enforces cap gate, applies decision, and logs.
- Context builder: `./src/tracking/context.ts`
  - Loads `bets/` catalog summaries and recent attribution history (JSONL).
- Selector (prompt + subprocess): `./src/tracking/selector.ts`
  - Builds the selector prompt and spawns `claude`.

### Claude subprocess invocation

The selector currently spawns the Claude CLI as:
```bash
claude --print --output-format json --model sonnet --setting-sources ""
```

Notes:
- The prompt is provided via stdin.
- The selector parses a JSON response envelope and expects a single JSON decision object.

## Prompt anatomy (what Claude sees)

The selector prompt is built in `buildPrompt()` (`./src/tracking/selector.ts`) and contains:
- Static constraints (no invented bet IDs, prefer `none` when uncertain, output schema requirements).
- Action semantics (`start`, `stop`, `switch`, `keep`, `none`).
- An **event-specific policy block** (different guidance for `session-end` vs `user-prompt-submit` vs tool events).
- A required output schema:
  - `{"action":"start|stop|switch|keep|none","bet_id":"optional","stop_bet_id":"optional","confidence":0-1,"reason":"short"}`
- A **pretty-printed** `Context JSON:` payload (via `JSON.stringify(..., null, 2)`) containing:
  - `event`
  - `active_bets`
  - `payload` (truncated hook stdin fields)
  - `bets` (catalog entries)
  - `recent_attribution` (recent JSONL entries)

Token usage is therefore dominated by:
1) the number/size of bets included in the context,
2) the number of recent attribution entries included,
3) payload size (prompt/tool I/O), and
4) how often hook events occur (especially tool events).

## Hard limits & truncation (bounds that affect token usage)

These caps determine worst-case prompt growth for a single selector invocation:

### Hook stdin payload truncation

In `./src/hooks/events.ts`:
- `MAX_FIELD_LENGTH = 2000`
- Truncated (when present): `prompt`, `toolName`, `toolInput`, `toolOutput`, `transcriptPath`, `cwd`

### Bets included in the prompt

In `./src/tracking/selector.ts`:
- The selector includes up to **50** bets (`.slice(0, 50)`).

### Bet summary truncation

In `./src/tracking/context.ts`:
- `MAX_BET_SUMMARY_CHARS = 800`
- `extractSection()` returns summarized content for:
  - `assumption`, `rationale`, `validationPlan`, `notes` (if sections exist)
- `summary` is also included and is summarized to <= 800 characters.

Practical implication: for each bet, the context may include *multiple* summarized fields (not just one), so prompt size can scale faster than “800 chars per bet” in the worst case.

### Attribution history included

In `./src/tracking/context.ts`:
- `MAX_HISTORY_ENTRIES = 20`

## Estimation method (simple + reproducible)

### Heuristic: tokens ≈ characters / 4

For rough sizing, use:
- `estimated_tokens ≈ characters / 4`

This is **approximate** and varies with:
- how much JSON vs natural language appears,
- identifier density (paths, IDs),
- model/tokenizer specifics.

### Reproducing prompt/response size stats from debug logs (read-only)

When hook debug logging is enabled, BEP writes selector debug entries under:
- `bets/_logs/hook_debug.log`

You can compute prompt character sizes by extracting `stage === "build_prompt"` entries (they include `data.prompt`).

Example (read-only) Node snippet:
```bash
node - <<'NODE'
const fs = require("fs");

const lines = fs.readFileSync("bets/_logs/hook_debug.log", "utf8").trim().split(/\n/);
const prompts = [];
for (const line of lines) {
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    continue;
  }
  if (obj.stage === "build_prompt" && obj.data && typeof obj.data.prompt === "string") {
    prompts.push({ at: obj.at, event: obj.event, chars: obj.data.prompt.length });
  }
}

prompts.sort((a, b) => a.chars - b.chars);
const avg = prompts.reduce((sum, x) => sum + x.chars, 0) / (prompts.length || 1);
console.log({ n: prompts.length });
if (prompts.length) {
  console.log({ min: prompts[0], median: prompts[Math.floor(prompts.length / 2)], avg, max: prompts[prompts.length - 1] });
}
NODE
```

You can compute response character sizes by extracting `stage === "parse_outer_json"` entries (they include `data.rawText`).

Example (read-only) Node snippet:
```bash
node - <<'NODE'
const fs = require("fs");

const lines = fs.readFileSync("bets/_logs/hook_debug.log", "utf8").trim().split(/\n/);
const outputs = [];
for (const line of lines) {
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    continue;
  }
  if (obj.stage === "parse_outer_json" && obj.data && typeof obj.data.rawText === "string") {
    outputs.push({ at: obj.at, event: obj.event, chars: obj.data.rawText.length });
  }
}

outputs.sort((a, b) => a.chars - b.chars);
const avg = outputs.reduce((sum, x) => sum + x.chars, 0) / (outputs.length || 1);
console.log({ n: outputs.length });
if (outputs.length) {
  console.log({ min: outputs[0], avg, max: outputs[outputs.length - 1] });
}
NODE
```

## Empirical sample (from this repo; 2026-02-20)

The existing `bets/_logs/hook_debug.log` in this repo contains selector debug entries dated **2026-02-20**.
Using the snippets above, the observed **sample** sizes were:

### Prompt size (stage: `build_prompt`)

Across `build_prompt` entries (N=15):
- min: **7,789 chars**
- median: **9,282 chars**
- avg: **9,110 chars**
- max: **10,191 chars**

Rough token estimate (characters/4):
- input tokens per invocation ≈ **1,950–2,550**

### Response size (stage: `parse_outer_json`)

Across `parse_outer_json` entries (N=15):
- min: **2,990 chars**
- avg: **3,098 chars**
- max: **3,184 chars**

Rough token estimate (characters/4):
- output tokens per invocation ≈ **~750–800**

### Total per invocation (very rough)

Combining the above:
- total tokens per hook invocation ≈ **~2,700–3,350**

This is a directional estimate, not a billing guarantee.

## Session-level cost model (frequency dominates)

Total tokens scale primarily with how many hook events fire:

```
total_tokens ≈ Σ_over_events( invocations(event) × tokens_per_invocation(event) )
```

Two examples using the empirical “~3k tokens per invocation” ballpark:

### Example A: light session
- 1× `user-prompt-submit`
- 3× `post-tool-use`
- 0× failures
- 1× `session-end`

Total invocations: 5 → total tokens ≈ **~15k**

### Example B: tool-heavy session
- 1× `user-prompt-submit`
- 20× `post-tool-use`
- 2× `post-tool-use-failure`
- 1× `session-end`

Total invocations: 24 → total tokens ≈ **~72k**

Implication: any effort to “de-risk token usage” should measure and manage **tool-event frequency** (as well as per-call prompt size).

## Next steps (not implemented in this phase)

This phase is documentation-only. **No prompt code changes** are planned here.

Possible next steps to get more accurate token accounting:
- Check whether the Claude CLI JSON output includes usage metadata (input/output tokens). If available, parse and log it.
- If the CLI does not expose usage, add lightweight logging of prompt/response **character counts** (and optionally estimated tokens) per invocation.
- Consider adding an optional “token estimation mode” that logs estimates without storing full prompt contents (to reduce sensitive-data risk).

Potential optimization directions (future exploration; not implemented here):
- Reduce repeated bet text in the context (for example, avoid including both detailed section summaries and `summary` if redundant).
- Reduce context breadth (for example, fewer bets, or only active + recently-touched bets).
- Reduce selector calls on tool events (batching/debouncing/sampling), if accuracy remains acceptable.
