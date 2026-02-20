# BEP: Budgeted Engineering Proposals
*A Git-native anti–sunk-cost system for AI-native builders.*

> Status: exploratory. This repository currently contains the product spec and is using README-driven development: update this README first, then make it true with code.

## README-driven development notes
This document is intentionally a **single-file introduction** that defines the initial *public interface* (CLI + file formats). If the README starts turning into a massive spec, that's a signal to split features into smaller, more modular pieces.

## Why
AI tools compress build time, but they don't compress:
- validation cycles
- feedback loops
- distribution uncertainty
- market learning
- strategic judgment

As build velocity increases, the cost of poor decisions compounds faster. BEP is meant to add a lightweight *pre-commitment layer* that makes sunk cost visible early and forces deliberate escalation decisions.

## What this is
BEP treats each feature as a **capped bet** with:
- a primary assumption
- an exposure cap (e.g. hours, sessions, calendar days)
- a validation metric (a "leading indicator")
- a default action if validation fails (kill / narrow / pivot)

This is intentionally **not**:
- a time tracker
- a PM tool
- an OKR system
- an analytics dashboard

## Core concepts
### Budgeted Engineering Proposal (BEP)
A BEP is a human-readable, machine-parseable document in your repo (planned format: Markdown + YAML frontmatter).

Example (draft schema):

```md
---
id: landing-page
status: active
max_hours: 12
max_calendar_days: 10

leading_indicator:
  type: manual
  operator: gte
  target: 20

default_action: kill
---

# Budgeted Engineering Proposal

## 1. Primary Assumption
What must be true for this feature to matter?

## 2. Rationale
Why this bet now?

## 3. Validation Plan
How signal will be collected.

## 4. Notes
Optional narrative context.
```

### Evidence snapshots
When a check runs, the system writes a snapshot to the repo so the decision trail is durable and reviewable.

Example (planned):
- `bets/_evidence/landing-page.json`

### Enforcement (configurable)
The goal is *friction at commitment escalation points*, not monitoring.

Planned modes:
- **Soft warning** at ~70% of exposure cap
- **Hard threshold prompt** at 100% (requires explicit override + justification)
- **Strict mode** (optional): refuse further assistance until the BEP is updated (extended cap / status change / decision recorded)

## Repository layout (planned)
```
bets/
  landing-page.md
  onboarding-v2.md
  payment-flow.md

  _state.json

  _logs/
    landing-page.jsonl
    onboarding-v2.jsonl

  _evidence/
    landing-page.json
```

`_state.json` stores active sessions:
```json
{
  "active": [
    { "id": "landing-page", "started_at": "2026-02-18T21:15:00.000Z" }
  ]
}
```

## CLI (proposed public API)
This README is defining the first-pass interface we intend to implement.

## Installation (current)
Run with `npx`:

```bash
npx bep-cli@latest <command>
```

## Agent Tracking (v1)
BEP supports hook-based session tracking to reduce manual time logging friction for AI-native workflows.

In v1, auto-tracking is focused on **Claude Code** hooks:
- High-value hook events are logged (`UserPromptSubmit`, `PostToolUse`, `PostToolUseFailure`, `SessionEnd`)
- Hook payloads are used to build attribution context (prompt/tool signals + current bet state)
- `bep hook` delegates bet selection to Claude CLI and can auto-apply `start` / `stop` / `switch`
- Cap checks run on every hook event for the attributed bet
- Hard blocking is enforced only on `UserPromptSubmit` when attributed bet usage is at/over cap
- Non-prompt over-cap events are logged for observability but are not hard-denied
- Low-confidence or failed attribution is non-blocking: BEP state is unchanged and uncertainty is logged
- Events are logged under `bets/_logs/agent-sessions.jsonl`
- Attribution decisions are logged under `bets/_logs/agent-attribution.jsonl`
- Over-cap detections are logged under `bets/_logs/agent-blocks.jsonl`
- No commit-count tracking in v1

Hard-block deny message includes the bet id, current usage vs cap, and unblock guidance (for example: extend `max_hours`/`max_calendar_days` or change bet status in `bets/<id>.md`).

Agent support matrix in the init UX:
- Claude Code: supported now
- Cursor: coming soon
- Codex: coming soon
- Windsurf: coming soon

The coming-soon agents are intentionally visible in selection so users can see roadmap direction.

### Initialize BEP in a repo
```bash
bep init
```
Creates `bets/`, `bets/_logs/`, and `bets/_evidence/`.

`bep init` then asks whether to install agent tracking hooks. If you opt in, it shows an agent selector with Claude Code plus coming-soon agents.

Hook install target resolution:
- The command walks up from your current directory (Git-style ancestor discovery)
- It uses the nearest existing `.claude` directory
- If no `.claude` directory exists in ancestors, install fails with setup guidance and writes no hook config

Only `bep init` creates BEP repo structure. All other commands require an existing initialized BEP repo.
Like Git, commands work from either the BEP repo root or any subdirectory under it.

### Init examples
Interactive:
```bash
bep init
# ? Install agent tracking hooks now?
# ? Choose an agent: Claude Code
# Installed Claude Code tracking hooks in .claude/settings.json.
```

Non-interactive:
```bash
bep init --install-hooks --agent claude-code
bep init --no-install-hooks
```

### Create a new bet
```bash
bep new landing-page
```
Runs an interactive wizard to collect:
- one cap type: `max_hours` or `max_calendar_days`
- a required numeric value for the chosen cap type
- `default_action` (`kill` / `narrow` / `pivot` / `extend`)
- `leading_indicator.type` (currently `manual`)
- `leading_indicator.operator` (one of `lt`, `lte`, `eq`, `gte`, `gt`)
- `leading_indicator.target` (required numeric threshold)
- `Primary Assumption` (required markdown text)
- `Rationale` (required markdown text)
- `Validation Plan` (required markdown text)
- `Notes` (optional markdown text)

Behavior:
- `id` must be unique: if `bets/<id>.md` already exists, the command fails.
- You can move back one step in the wizard to revise the previous answer.
- Chosen values are shown above each next question.

Creates `bets/landing-page.md` from a template.

### Activate a bet for work
```bash
bep start landing-page
```
Starts a work session for an existing BEP:
- validates `id` as a lowercase slug
- requires `bets/<id>.md` to already exist
- adds `{ id, started_at }` to `bets/_state.json` under `active`
- avoids duplicates (if already active, it exits successfully without changing `started_at`)
- sets `status: active` in `bets/<id>.md` frontmatter

`bep start <id>` supports multiple active bets at the same time.

### Stop a bet session (and log exposure)
```bash
bep stop landing-page
```
Stops all active sessions for that bet id, appends one JSON line per stopped session to `bets/_logs/<id>.jsonl`, and updates `status: paused` in `bets/<id>.md` when the markdown file exists.

If the id is not active, the command exits successfully with a no-op message.
Each JSONL entry has: `id`, `started_at`, `stopped_at`, `duration_seconds`.

### Check validation status
```bash
bep check landing-page
```
Runs an interactive manual check:
- prompts for an observed value (required numeric)
- prompts for notes (optional)
- compares observed value vs `leading_indicator.target` using `leading_indicator.operator`
- writes a snapshot to `bets/_evidence/<id>.json` including the comparison result

This v0 flow captures evidence and evaluates pass/fail for manual numeric checks.
Validation is dispatched through a provider registry. Unknown `leading_indicator.type` values fail fast with an invalid-config error.

### Summarize current bets
```bash
bep status
```
Shows:
- active bets
- exposure used vs cap
- cap warning labels (`NEARING_CAP` at >=70%, `AT_CAP` at >=100%)
- last known validation result vs target

## Intended workflow
1. **Declare the bet**: write `bets/<id>.md` (assumption, cap, validation, default action).
2. **Activate the bet**: `bep start <id>`.
3. **Accumulate exposure**: sessions/hours are logged to `bets/_logs/`.
4. **Check validation**: `bep check <id>` (on interval or at cap).
5. **Decision moment at threshold**: kill / narrow / pivot / extend-with-justification (recorded in Git).
6. **Review history**: learn from killed bets and recalibrate.

## Integrations (planned)
Validation providers are modular:
- each provider owns config parsing + check execution
- providers can optionally own setup prompts used by `bep new`

Current registered provider:
- `manual`

Validation sources under consideration (to be added incrementally as usage feedback arrives):
- PostHog, Mixpanel, Amplitude
- read-only SQL queries
- Prometheus/Grafana metrics
- custom metric endpoints
- internal event logs

The system should surface evidence and compare to the declared threshold; it should not autonomously decide viability.

## Roadmap (draft)
- Define the v0 BEP file schema (frontmatter fields + required sections)
- Implement `bep init/new/status` with zero external dependencies
- Implement exposure logging (sessions first; hours derived)
- Implement manual `bep check` evidence capture and evolve provider integrations iteratively
- Add optional "hard threshold" prompting behavior

## Contributing
If you want to help, start by:
- proposing changes to the BEP schema (fields, required sections, ergonomics)
- stress-testing the CLI surface area above (what's missing / too much / unclear)
- suggesting minimal enforcement defaults that don't feel bureaucratic

---

For the longer-form thinking behind this, see `product_thinking.md`.
