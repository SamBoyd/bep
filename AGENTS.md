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

# Technology stack (keep current)

Maintain this section as the source of truth for the repo's major technologies.

- Runtime/language: Node.js + TypeScript
- CLI framework: `commander`
- Build tooling: `tsup`
- Test framework: `jest` (`ts-jest`)
- Current package format: CommonJS (`"type": "commonjs"`)

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
│   └── ui/                # Interactive prompt flows/wizard helpers
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
