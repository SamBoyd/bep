# Backwards compatibility

The current version of this project v0.1.0, is determined as EXPERIMENTAL. Therefore breaking changes are expected by it's users. As such, you will not make changes backward compatible until version v1.0.0

# Git commits

After completing a major code change, include a suggested git commit message at the end of your response.

Use Conventional Commits v1.0.0 structure:

`<type>[optional scope][!]: <description>`

`[optional body]`

`[optional footer(s)]`

Follow these rules:

- Use a valid type. Prefer: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`, `revert`.
- Add an optional scope when helpful (for example `sync`, `blog`, `mixpanel`, `content`, `docusaurus`).
- Keep the description short, specific, and actionable.
- Add a body when context is useful; separate it from the header with one blank line.
- IMPORTANT: Explain intent and impact in the body (why this change was needed, what behavior changed). 
- Use footers for metadata like issue refs (`Refs: #123`) or review trailers (`Reviewed-by: name`).
- Mark breaking changes with `!` in the header and/or a `BREAKING CHANGE: <description>` footer.
- Keep formatting machine-parseable and consistent so release tooling can use commit history.

Format the suggestion as:

**Suggested commit message:**
```text
<type>(<scope>): <short description>

<optional body explaining intent and impact>

<optional footer(s)>
```

# Workflow

We work in small git-committable chunks, involving USER for checking our changes and letting them commit

# PLAN FORMAT

EARS (Easy Approach to Requirements Syntax) is used in plans for specifying *system behavior* (requirements), not for describing the agent's implementation to-do list.

Use the structure below for code-change plans.

## REQUIREMENTS FORMAT (EARS)

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

## IMPLEMENTATION PLAN FORMAT

Describe *how* you'll satisfy the requirements as concrete steps (agent actions), chunked into small git-committable units when appropriate.

- Size the steps to the change: use as few steps as needed for small fixes, and break larger changes into multiple git-committable chunks.
- Keep one concrete outcome per step (code change, test addition, verification, or user checkpoint).
- Include a USER checkpoint step for major or risky changes, consistent with the workflow above.

## VERIFICATION FORMAT

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

# Test migration status

The Jest suite is currently mid-migration to ESM-native test patterns.

- `tests/jest.setup.ts` temporarily restores the `jest` global to preserve existing test style during migration.
- When touching a test file, prefer migrating it to ESM-native usage in that same change:
  - `import { jest } from "@jest/globals"` (instead of relying on the global)
  - Use `await jest.unstable_mockModule(...)` + dynamic `import(...)` for module mocks in ESM tests
  - Avoid `jest.requireActual(...)` in ESM tests; use `await import(...)` for actual modules
- Do not remove `tests/jest.setup.ts` until the suite no longer depends on the global `jest` fallback.

# Technology stack (keep current)

Maintain this section as the source of truth for the repo's major technologies.

- Runtime/language: Node.js + TypeScript
- CLI framework: `commander`
- TUI renderer (new bet wizard): `ink` + `react` (experimental)
- Build tooling: `tsup`
- Test framework: `jest` (`ts-jest`)
- Current package format: ESM (`"type": "module"`)

# Technology list maintenance rules

- If you introduce, remove, or replace a meaningful library/tool (CLI, build, test, runtime, lint, formatting, DB, framework), update this technology list in the same change.
- Keep entries short and practical; prefer the library/tool name and its purpose in this repo.
- Ensure the list stays consistent with `package.json`, build config, and test config.
- If a tool is temporary/experimental, mark it explicitly as such.

# Project layout (high-level, keep current)

Update this map whenever directories, entrypoints, or core config locations change.

```text
.
├── AGENTS.md              # Agent instructions and project conventions
├── README.md              # Product-facing overview and CLI contract
├── package.json           # NPM metadata, scripts, dependencies, bin mapping
├── jest.config.cjs        # Jest configuration
├── tsconfig.json          # TypeScript compiler configuration
├── tsup.config.ts         # Build/bundle configuration
├── src/
│   ├── cli.ts             # CLI entrypoint and command registration
│   ├── commands/          # CLI command handlers (e.g., init)
│   ├── bep/               # BEP domain helpers (ids, templates, parsing)
│   ├── hooks/             # Agent hook install/discovery and hook config writers
│   ├── providers/         # Validation provider interfaces, registry, and adapters
│   ├── fs/                # Filesystem/domain helpers (repo layout/state setup)
│   ├── state/             # State read/write/validation helpers
│   ├── tracking/          # Hook payload parsing, bet-selection context, and attribution logic
│   └── ui/                # Interactive prompt flows/wizard helpers (Clack + Ink)
│       └── ink/           # Ink-based interactive UI components/controllers (new wizard)
└── tests/                 # Jest test suites for units/commands
    ├── commands/          # Command-level behavior tests
    ├── fs/                # Filesystem helper tests
    ├── bep/               # BEP domain helper tests
    ├── hooks/             # Agent hook discovery/installer tests
    ├── providers/         # Provider adapter and setup tests
    ├── state/             # State module tests
    ├── tracking/          # Bet attribution context/selector/decision tests
    └── ui/                # Wizard flow tests
```
