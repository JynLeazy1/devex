# `.kiro/steering/` — context for AI-assisted development

Markdown files in this directory provide standing context to AI assistants
(Amazon Q Developer, Kiro) when they generate code, review PRs, or answer
questions about this codebase.

Kiro reads these files **alphabetically**, so the numeric prefix controls the
load order: foundational context (architecture) before tactical rules (review).

## Files

| File | Purpose |
|---|---|
| [`01-architecture.md`](./01-architecture.md) | What `devex` is, the two-product structure, how the pipeline flows |
| [`02-conventions.md`](./02-conventions.md) | Naming, code style, testing rules, commits |
| [`03-patterns.md`](./03-patterns.md) | Recurring patterns to follow; anti-patterns to refuse |
| [`04-glossary.md`](./04-glossary.md) | Domain terms (Work ID, Golden Path, StackProfile, etc.) |
| [`05-ai-review-rules.md`](./05-ai-review-rules.md) | Specific instructions when reviewing PRs |

## How to update

When you discover a new convention or anti-pattern that should be enforced by
AI tooling, add it to the relevant file. Steering files are part of the
inner-source contribution flow — same PR process as code.

## Related

- [Full design rationale: ADR-001](../../adr/ADR-001-devex-golden-path-ecosystem.md)
- [Contribution guide for humans: CONTRIBUTING.md](../../CONTRIBUTING.md)
- [Root README](../../README.md)
