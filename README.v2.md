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

Expected status output shape:
```text
id            status  active  exposure_h  cap     cap_%  warning  validation
landing-page  paused  no      0.00        12.00h  0.00%  -        N/A
```

---

## Current CLI Surface
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
