# BEP: Budgeted Engineering Proposals
*A Git-native anti–sunk-cost system for AI-native builders.*

> Status: exploratory. This repository currently contains the product spec and is using README-driven development: update this README first, then make it true with code.

## README-driven development notes
This document is intentionally a **single-file introduction** that defines the initial *public interface* (CLI + file formats). If the README starts turning into a massive spec, that’s a signal to split features into smaller, more modular pieces.

## Why
AI tools compress build time, but they don’t compress:
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
- a validation metric (a “leading indicator”)
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
  type: posthog
  query: "event='signup' AND source='landing_v2'"
  target: ">= 20"
  window: "7d"eee

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
    landing-page.time.log
    onboarding-v2.time.log

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

## Installation (proposed)
We want installs to be:
- **one command** for end users
- no runtime dependencies (single binary)
- cross-platform (macOS/Linux/Windows)

Implementation plan: Go CLI + Charmbracelet TUI (`bubbletea`/`lipgloss`/`bubbles`).

### Recommended (end users): Homebrew
Target UX (once published):
```bash
brew install <tap>/bep
```

### Alternative (end users): prebuilt binaries
Plan: publish release artifacts for macOS/Linux/Windows and provide a curl/powershell install snippet.

### From source (contributors): Go toolchain
Target UX:
```bash
go install ./cmd/bep
```

If/when this becomes a published Go module:
```bash
go install <module>/cmd/bep@latest
```

### Other distribution channels (later)
- package managers (Scoop, AUR, etc.)

## TUI (planned)
The command surface should support both:
- **a fast interactive TUI** for day-to-day use
- **stable subcommands** for scripting/automation

Proposed behavior:
- `bep` opens the TUI dashboard (active bets, exposure vs cap, last evidence snapshot)
- `bep <subcommand>` runs in non-interactive mode (CI-friendly)

### Initialize BEP in a repo
```bash
bep init
```
Creates `bets/`, `bets/_logs/`, and `bets/_evidence/`.

### Create a new bet
```bash
bep new landing-page
```
Runs an interactive wizard to collect:
- one cap type: `max_hours` or `max_calendar_days`
- a required numeric value for the chosen cap type
- `default_action` (`kill` / `narrow` / `pivot` / `extend`)

Behavior:
- `id` must be unique: if `bets/<id>.md` already exists, the command fails.
- You can move back one step in the wizard to revise the previous answer.
- Chosen values are shown above each next question.
- `leading_indicator` is intentionally deferred until validation mechanics are defined.

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
bep stop
```
Appends time/session exposure to `bets/_logs/<id>.time.log`.

### Check validation status
```bash
bep check landing-page
```
Pulls current metric value from the configured source, compares to the declared target, and writes a snapshot to `bets/_evidence/<id>.json`.

### Summarize current bets
```bash
bep status
```
Shows:
- active bets
- exposure used vs cap
- last known validation result vs target

## Intended workflow
1. **Declare the bet**: write `bets/<id>.md` (assumption, cap, validation, default action).
2. **Activate the bet**: `bep start <id>`.
3. **Accumulate exposure**: sessions/hours are logged to `bets/_logs/`.
4. **Check validation**: `bep check <id>` (on interval or at cap).
5. **Decision moment at threshold**: kill / narrow / pivot / extend-with-justification (recorded in Git).
6. **Review history**: learn from killed bets and recalibrate.

## Integrations (planned)
Validation sources under consideration:
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
- Implement `bep check` with one metrics provider (likely PostHog) + local JSON evidence snapshots
- Add optional “hard threshold” prompting behavior

## Contributing
If you want to help, start by:
- proposing changes to the BEP schema (fields, required sections, ergonomics)
- stress-testing the CLI surface area above (what’s missing / too much / unclear)
- suggesting minimal enforcement defaults that don’t feel bureaucratic

---

For the longer-form thinking behind this, see `product_thinking.md`.
