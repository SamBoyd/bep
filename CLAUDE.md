# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build        # compile with tsup → dist/cli.js
npm test             # build then run all Jest tests
npx jest <pattern>  # run a single test file, e.g. npx jest tests/commands/hook
```

There is no lint script configured; TypeScript type-checking is done implicitly by ts-jest during tests.

## Technology stack

- **Runtime/language**: Node.js + TypeScript (CommonJS output)
- **CLI framework**: `commander`
- **Interactive prompts**: `@clack/prompts`
- **Frontmatter parsing**: `gray-matter`
- **Build**: `tsup` (entry: `src/cli.ts` → `dist/cli.js` with `#!/usr/bin/env node` banner)
- **Tests**: `jest` + `ts-jest` (test files must match `tests/**/*.test.ts`)

## Architecture

BEP is a CLI tool that treats engineering features as capped bets tracked in a `bets/` directory inside a repo. The repo layout it creates:

```
bets/
  <id>.md           # BEP document (markdown body + YAML frontmatter)
  _state.json       # active session tracking  { "active": [{ id, started_at }] }
  _logs/
    <id>.jsonl              # per-bet session exposure (start/stop pairs)
    agent-sessions.jsonl    # Claude Code hook event log
    agent-attribution.jsonl # Claude-driven bet-selection decisions
  _evidence/
    <id>.json       # last validation snapshot
```

### Key architectural patterns

**Repo resolution** — `src/fs/init.ts:findInitializedRepo` walks up from `cwd` (Git-style ancestor search) to find the nearest directory containing the required `bets/` structure. All commands call `ensureInitializedRepo` and pass the resolved `rootDir` through to every FS helper. Only `bep init` creates the structure; all other commands require it to already exist.

**BEP file model** — `src/bep/file.ts` defines `BetFile = { content: string; data: BetFrontmatter }`. Files are read via `gray-matter` and written back with `matter.stringify`. Helpers live in `src/fs/bets.ts`.

**Commands** — each command is a `runXxx(args, deps?)` function in `src/commands/`. They return a numeric exit code (0 = success). The CLI entrypoint (`src/cli.ts`) registers all commands with commander and assigns the return value to `process.exitCode`. Commands use dependency injection for side-effecting operations to keep tests hermetic.

**Validation providers** — `src/providers/registry.ts` maps `leading_indicator.type` strings to provider implementations. The only registered provider is `manual` (`src/providers/manual.ts`). Unknown types fail fast. New providers implement the interface in `src/providers/types.ts`.

**Agent hook tracking** — `bep hook <agent> <event>` is the internal command invoked by Claude Code hooks. It:
1. Reads JSON from stdin (`src/hooks/events.ts:parseHookStdin`)
2. Builds a `SelectionContext` with active bets and recent attribution history (`src/tracking/context.ts`)
3. Calls `selectBetWithClaude` (`src/tracking/selector.ts`) which uses the Claude CLI to pick a bet action (`start`/`stop`/`switch`/`keep`/`none`)
4. Applies the decision (`src/tracking/decision.ts`) by calling start/stop commands
5. Appends to both `agent-sessions.jsonl` and `agent-attribution.jsonl`

Hook errors are always non-blocking (exit 0); failures are logged.

**Hook install** — `src/hooks/claude.ts` writes BEP hook entries into `.claude/settings.json`. `src/hooks/discovery.ts` walks ancestors to find an existing `.claude/` directory. If none exists, install fails with guidance.

## Git commit conventions

Use Conventional Commits v1.0.0: `<type>(<scope>): <description>`. After completing a significant change, include a suggested commit message. Body should explain intent and impact (why, not just what). Mark breaking changes with `!` and/or a `BREAKING CHANGE:` footer.

## Development workflow

Work in small, git-committable chunks. Present changes for review before committing; don't auto-commit.

Update `AGENTS.md` (the project layout and technology stack sections) whenever directories, entrypoints, major libraries, or config locations change.

## PLAN FORMAT

EARS (Easy Approach to Requirements Syntax) is used in plans for specifying *system behavior* (requirements), not for describing the agent's implementation to-do list.

Use the structure below for code-change plans.

### REQUIREMENTS FORMAT (EARS)

Write compact, testable requirements about the system/component under change (not the agent). Name the system explicitly (e.g. `InkNewWizard`, `bep new`, `WizardState`).

- Ubiquitous (always true): `The <system> shall <response>.`
- State-driven: `While <precondition(s)>, the <system> shall <response>.`
- Event-driven: `When <trigger>, the <system> shall <response>.`
- Optional feature/scope: `Where <feature/scope applies>, the <system> shall <response>.`
- Unwanted behavior: `If <unwanted condition>, then the <system> shall <mitigation>.`
- Complex: `While <precondition(s)>, when <trigger>, the <system> shall <response>.`

Practical rules:

- Use requirement IDs (`R1`, `R2`, ...) so implementation and verification can reference them.
- Prefer observable behavior and invariants; avoid file/function names unless they are part of the external contract.

### IMPLEMENTATION PLAN FORMAT

Describe *how* you'll satisfy the requirements as concrete steps (agent actions), chunked into small git-committable units when appropriate.

- Size the steps to the change: use as few steps as needed for small fixes, and break larger changes into multiple git-committable chunks.
- Keep one concrete outcome per step (code change, test addition, verification, or user checkpoint).
- Include a USER checkpoint step for major or risky changes, consistent with the workflow above.

### VERIFICATION FORMAT

Include explicit checks that map back to the requirements.

- Each verification item should reference one or more requirement IDs (`R#`) and name the check (`npm test`, `npm run build`, or targeted manual validation).

Template (shape only):

- Requirements:
- `R1: When <trigger>, the <system> shall <response>.`
- `R2: While <state>, the <system> shall <response>.`
- Implementation:
- `S1: <edit(s) that satisfy R1/R2>.`
- `S2: USER checkpoint: review/commit chunk 1.`
- Verification:
- `V1 (R1,R2): npm test`