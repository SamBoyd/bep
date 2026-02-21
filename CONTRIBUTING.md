# Contributing to BEP

Thanks for contributing to BEP.

BEP is currently **experimental** (`v0.1.0`), so we optimize for learning speed, clear decisions, and reviewable changes over long-term API stability.

## Project Stage and Expectations
- Breaking changes are expected before `v1.0.0`.
- Backward compatibility is not required yet unless explicitly requested.
- Contributions should reduce ambiguity around product behavior, not just add code.

## What We Value
- Small, focused PRs that are easy to review and reason about.
- Clear intent: explain the problem and expected behavior change.
- Tests for behavior changes.
- Docs updates when CLI behavior, schema, or workflow changes.

## Good First Contribution Types
- Improve command UX and error messages.
- Add or refine tests for edge cases.
- Clarify docs around bet lifecycle, checks, or hooks.
- Improve provider integrations (starting with Mixpanel and manual flows).

## Before You Start
1. Open an issue (or discussion) describing the problem and proposed approach.
2. Confirm scope and acceptance criteria before implementing larger changes.
3. Keep work in small, commit-ready chunks.

## Local Development
### Prerequisites
- Node.js 20+
- npm

### Setup
```bash
npm install
npm run build
npm test
```

### Run CLI locally
```bash
node dist/cli.js --help
```

## Contribution Workflow
1. Create a focused branch.
2. Make one coherent change at a time.
3. Add or update tests in `tests/` for behavior changes.
4. Update docs when public behavior changes.
5. Run:
```bash
npm run build
npm test
```
6. Open a PR with a clear summary, rationale, and test evidence.

## Coding Guidelines
- Prefer explicit, readable logic over clever abstractions.
- Keep modules cohesive and responsibilities clear.
- Preserve current stack unless a change is justified:
  - Node.js + TypeScript
  - `commander`
  - `tsup`
  - `jest` (`ts-jest`)
  - CommonJS package output

## Testing Expectations
- Add tests for bug fixes and new behavior.
- Keep tests deterministic and fast.
- Cover command-level behavior for CLI changes when possible.

## Documentation Expectations
Update docs in the same PR when changing:
- CLI commands, flags, or output expectations
- BEP schema or validation behavior
- provider setup/integration flows
- hook integration behavior

## Decision-Making for Experimental Changes
When introducing a major behavior change, include:
- The problem being solved
- Why this approach is preferred
- Tradeoffs and known limitations
- What success looks like

## Pull Request Checklist
- [ ] Scope is focused and reviewable
- [ ] Behavior changes are tested
- [ ] Docs updated for user-visible changes
- [ ] Build and tests pass locally
- [ ] PR description explains intent and impact

## Commit Messages
Use Conventional Commits where practical:
- `feat: ...`
- `fix: ...`
- `docs: ...`
- `refactor: ...`
- `test: ...`

## Code of Conduct
Be respectful, direct, and constructive.
Assume good intent, and ground feedback in behavior and evidence.
