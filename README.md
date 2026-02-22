<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./img/banner-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="./img/banner-light.png">
    <img alt="Project Banner" src="./img/banner-light.png">
  </picture>
</p>

# BEP: a guardrail for Claude Code
*Prevent runaway build-spend by forcing every feature into a budgeted validation bet.*

> “This is a Claude Code guardrail that prevents runaway build-spend by forcing every feature into a budgeted validation bet.”

BEP turns “build whatever” into **budgeted bets**:
- a time cap (hours / calendar days),
- a validation target (what would prove this matters),
- a fallback (what you do if validation fails).

Token-burn protection for feature work: BEP is the moment where you decide, *do we validate, or do we keep building?*

## How it works (3 lines)
1. **Define a bet** (`bep new`) with a cap + validation target.
2. **Track time** manually (`bep start`/`bep stop`) or automatically via Claude Code hooks (`bep init --install-hooks`).
3. **Use the guardrail**: `bep status` shows when you’re nearing/at cap; Claude hooks can hard-stop new prompts when you’re at cap.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./img/diagram-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="./img/diagram-light.svg">
    <img alt="FSM Diagram" src="./img/diagram-light.svg">
  </picture>
</p>
---

## Quick start (Claude Code)

### 1) Install BEP
```bash
npx bep-cli@latest --help
```

### 2) Initialize in your repo
```bash
bep init
```
This creates repo-local state under `bets/`:
```text
bets/
  <id>.md
  _state.json
  _logs/
  _evidence/
```
It also creates `.bep.providers.json` (provider config) and (if this is a Git repo) adds `.bep.providers.json` to `.gitignore`.

During `init`, BEP will ask if you want to install Claude Code hooks. If you say yes, it writes commands into `.claude/settings.json` for these hook events:
`UserPromptSubmit`, `PostToolUse`, `PostToolUseFailure`, `SessionEnd`.

Non-interactive install:
```bash
# Requires a `.claude/` directory in this repo (or a parent directory)
bep init --install-hooks --agent claude-code
```

### 3) Create a bet
```bash
bep new landing-page-cta
```

### 4) Use Claude Code (automatic time tracking)
Once hooks are installed, Claude Code will call BEP on hook events. BEP will try to attribute work to a bet and (when confident) automatically `start`/`stop`/`switch` so time is tracked without you babysitting timers.

Practical pattern: tell Claude which bet it is working on (use the bet id in your prompt), then build until the guardrail warns/blocks.

### 5) Check the guardrail
```bash
bep status
```

Manual override (if you want it):
```bash
bep start landing-page-cta
bep stop landing-page-cta
```

---

## Why Claude Code users use BEP

Claude is extremely good at *building*. The failure mode is spending hours/tokens producing “finished” features before you’ve validated the underlying assumption.

BEP gives you three guardrails:
- **Time caps**: stop after N hours (or calendar days) instead of “just one more change”.
- **Validation targets**: force a measurable check before expanding scope.
- **Fallbacks**: when validation fails, you have a default next move (kill, narrow, pivot, extend).

Stop agents from turning uncertainty into sunk cost.

---

## Claude Code mode (hooks that can stop runaway prompts)

### What BEP installs
`bep init --install-hooks --agent claude-code` writes hook commands into `.claude/settings.json` that call:
```text
bep hook claude-code user-prompt-submit
bep hook claude-code post-tool-use
bep hook claude-code post-tool-use-failure
bep hook claude-code session-end
```

### What the guardrail actually does
On `user-prompt-submit`, BEP may respond with JSON like:
```json
{"continue": false, "stopReason": "Bet 'landing-page-cta' is at cap ..."}
```
That is the “kill switch” moment: Claude is about to keep going, BEP says “stop and validate (or change the bet).”

You can sanity-check the hook command locally:
```bash
echo '{"session_id":"demo","prompt":"Implement more changes","cwd":"/repo"}' \
  | bep hook claude-code user-prompt-submit
```

Notes:
- Hook events are logged under `bets/_logs/` (for example: `bets/_logs/agent-sessions.jsonl`, `bets/_logs/agent-attribution.jsonl`, `bets/_logs/agent-blocks.jsonl`).
- If BEP can’t confidently attribute work to a bet, it logs uncertainty and stays non-blocking.

---

## A realistic workflow (day in the life)
1. `bep new pricing-page` (set cap, validation, fallback).
2. `bep start pricing-page`.
3. Paste the “agent contract” (next section) into Claude Code.
4. Let Claude implement until BEP warns you via `bep status` or blocks new prompts via hooks.
5. Run the validation step; capture evidence with `bep check pricing-page`.
6. If validation fails: do the fallback instead of polishing the feature.

---

## Using BEP as an agent contract (paste into Claude)

Use this as a system-style rule for Claude Code when working on a bet:
- Implement only until you hit the time cap (or BEP blocks prompts).
- If you’re blocked or nearing cap, propose the *smallest validation step* that would change the decision.
- If validation can’t be reached cheaply, propose the bet’s fallback (kill, narrow, pivot, extend) and stop building.

---

## What BEP is (and isn’t)
- BEP is a repo-native guardrail for decisions under uncertainty.
- BEP isn’t a PM suite, an OKR system, or a time-tracking app.

---

## CLI surface (current)
Use `npx bep-cli@latest ...` if you have not installed it globally.

```text
bep init [options]
bep new [id...]
bep start <id>
bep stop <id>
bep status
bep check <id>
bep hook <agent> <event>
```

`bep init` options:
- `--install-hooks`
- `--no-install-hooks`
- `--agent <agent>` (currently: `claude-code`)

---

## Experimental status (v0.1.0)
This project is experimental. Expect breaking changes before `v1.0.0`.

Safe to try:
- BEP only adds repo-local files/config under `bets/` and `.bep.providers.json`, plus optional hook config in `.claude/settings.json` if you choose hook install.
- To remove it, delete `bets/`, delete `.bep.providers.json`, and remove the `.bep.providers.json` entry from `.gitignore` if BEP added it.

---

## More docs
- `README.md` (full project overview)
- `docs/agents/claude-code-hooks-integration.md` (hook integration notes; currently a stub)
- `docs/providers/mixpanel.md` (Mixpanel validation provider)
