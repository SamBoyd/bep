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

When creating a plan for a code change, use compact EARS-style statements (Easy Approach to Requirements Syntax) so each step is clear, testable, and easy to review.

Use the EARS patterns in plan items:

- Ubiquitous (always true): `The agent shall <action/outcome>.`
- State-driven (applies while a condition remains true): `While <condition>, the agent shall <action/outcome>.`
- Event-driven (triggered action): `When <trigger>, the agent shall <action/outcome>.`
- Optional feature/scope: `Where <feature/scope applies>, the agent shall <action/outcome>.`
- Unwanted behavior / contingency: `If <risk/problem>, then the agent shall <mitigation/fallback>.`
- Complex (combine state + trigger when useful): `While <condition>, when <trigger>, the agent shall <action/outcome>.`

Plan writing rules:

- Size the plan to the change: use as few items as needed for small fixes, and break larger changes into multiple git-committable chunks.
- Keep one concrete outcome per item (code change, test, verification, or user checkpoint).
- Include at least one verification item (`test`, `lint`, or targeted manual validation) when behavior changes.
- Include a USER checkpoint item for major or risky changes, consistent with the workflow above.
- Use repo-specific terms (files/commands/modules) instead of vague nouns.

Example (shape only):

- `When adding a new CLI command, the agent shall update command registration in src/cli.ts.`
- `Where the command changes persisted state, the agent shall add or update state module tests.`
- `If test execution is blocked by environment limits, then the agent shall report what was not run and why.`

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
