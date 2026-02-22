<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./img/banner-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="./img/banner-light.png">
    <img alt="Project Banner" src="./img/banner-light.png" width="830">
  </picture>
</p>

# BEP: Budgeted Engineering Proposals
**A Git-native pre-commitment CLI for AI-native builders.**

![Version](https://img.shields.io/badge/version-v0.1.0-blue)
![Status](https://img.shields.io/badge/status-experimental-orange)
![License](https://img.shields.io/badge/license-MIT-green)

BEP exists to add decision discipline where AI-assisted coding is fast but validation is still slow.

Instead of treating work as an endless task list, BEP treats each feature as a capped bet with a declared assumption, exposure limit, validation target, and default fallback action.

---

## Why This Exists
AI tools compress implementation time. They do not compress:
- validation cycles
- feedback loops
- distribution uncertainty
- market learning
- strategic judgment

That gap creates a failure mode: teams can over-invest in the wrong thing faster than ever.

BEP introduces lightweight friction at escalation points so sunk cost becomes visible before it compounds.

---

## What Makes BEP Different
- **Bet-first model:** Every feature is framed as a bounded experiment, not an open-ended task.
- **Repo-native state:** BEPs, logs, and evidence live in Git with your code.
- **CLI workflow:** `init`, `new`, `start`, `stop`, `status`, and `check` are designed for daily use.
- **Agent-aware tracking:** Hook-based tracking supports AI-native workflows (Claude Code in v1).
- **Enforcement orientation:** The product is explicitly about commitment control, not project management dashboards.

---

## Documentation 📚
- 🏗️ [Architecture](./docs/architecture.md)
- 🧠 [Thesis](./docs/thesis.md)
- 🤖 [Claude Code Hooks Integration](./docs/agents/claude-code-hooks-integration.md)
- 📊 [Mixpanel Provider](./docs/providers/mixpanel.md)

---

## Quick Start

### Install / run
```bash
npx bep-cli@latest --help
```

### 60-second path
```bash
# 1) Initialize BEP in your repo
npx bep-cli@latest init

# 2) Create your first bet (interactive wizard)
npx bep-cli@latest new landing-page

# 3) Start work on that bet
npx bep-cli@latest start landing-page

# 4) Stop and log session exposure
npx bep-cli@latest stop landing-page

# 5) Review status
npx bep-cli@latest status
```

After `init`, BEP creates repo-local state (example shape):
```text
.bep/                   # directory for the bet files
├── _state_.json        # which bets are currently being tracked
├── _logs/              # session logs
└── _evidence/          # validation logs
.bep.providers.json     # analytics providers config
```

Expected status output shape:
```text
id            status  active  exposure_h  cap     cap_%  warning  validation
landing-page  paused  no      0.00        12.00h  0.00%  -        N/A
```

<details>
<summary>Example bet file (what "assumption / cap / validation / fallback" looks like)</summary>

```yaml
---
id: landing-page-cta
status: paused
created_at: '2026-02-20T01:58:48.251Z'
leading_indicator:
  type: mixpanel
  report: Landing Page CTA Funnel
  metric: signup_completed_rate
  operator: gte
  target: 0.12
max_hours: 12
---
# Budgeted Engineering Proposal

## 1. Primary Assumption

That adding a clearer primary CTA to the landing page will increase visitor-to-signup conversion rate.

## 2. Rationale

The current landing page explains the product well enough, but the next step is not obvious. A stronger CTA should reduce hesitation and improve signup completion without changing pricing or onboarding.

## 3. Validation Plan

Use the Mixpanel "Landing Page CTA Funnel" report to compare `signup_completed_rate` after shipping the CTA change. This bet succeeds if the conversion rate reaches at least 12%.

## 4. Notes
```
</details>

Enforcement example (`bep check landing-page`):
```text
landing-page  exposure 10.2h / 12.0h (85.0%)  WARNING: near cap
$ echo $?    # exit code after warning
0

landing-page  exposure 12.4h / 12.0h (103.3%)  FAIL: cap exceeded
$ echo $?    # exit code after cap breach
1
```

---

## Current CLI Surface
Use `npx bep-cli@latest ...` if you have not installed it globally. The commands below show the installed binary form (`bep ...`); they are the same CLI.

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
- `--agent <agent>` (`claude-code` currently supported)

---

## Experimental Status (v0.1.0)
This project is a research prototype.

Expect:
- unstable APIs and command behavior
- data model changes
- no backward compatibility guarantees before `v1.0.0`

BEP is currently intended for early adopters and collaborators, not production stability.

## Safe To Try
- BEP only adds repo-local files/config (primarily under `.bep/`, plus optional hook config if you choose hook install).
- To remove it, delete `.bep/` and any BEP hook entries/config you enabled during `init`.

---

## Roadmap 🗺️
### Now (stabilize v0.1.x)
- ✅ Core CLI is shipped (`init`, `new`, `start`, `stop`, `status`, `check`, `hook`)
- 📊 Initial support for Mixpanel analytics
- 🤖 Initial support for Claude Code coding agent

### Next (expand practical capability)
- 📊 Add more analytics providers beyond Mixpanel (PostHog, Amplitude... )
- 🧩 Improve provider UX, including auto-extracting Mixpanel ids from report URLs
- 🤖 Expand agent integrations beyond Claude Code (Cursor, Codex, Windsurf)
- 🛠️ Add skills-based flows so agents can create bets and set up reports consistently

### Later (structured experimentation)
- 🌳 Introduce tree-structured bets (parent/child bet hierarchies)
- 🔎 Support richer report query complexity and validation logic
- 🎛️ Explore an Ink-based TUI for advanced interactive workflows
