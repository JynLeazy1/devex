# `.kiro/specs/` — Spec-Driven Development

Markdown specs that drive Kiro's spec-driven workflow: feature proposals,
behavior contracts, and acceptance criteria that an AI assistant can read
to generate scaffolding and tests.

## When to add a spec

- Before implementing a non-trivial feature
- When the feature crosses both packages (CLI + framework)
- When inner-source contributors need a shared mental model before coding

For trivial additive changes (a new CLI flag, a small fix), open a PR directly.

## Current specs

(none yet — populate as features land in v0.2+)

## Spec template

When creating `<feature-name>.md`, include:

```markdown
# Spec: <feature name>

## Summary
1–2 sentences on what this delivers.

## Motivation
The problem this solves. What pain or risk it addresses.

## API surface
- New exports / props / CLI flags introduced
- Affected modules

## Behavior contract
- Inputs accepted
- Outputs produced
- Error conditions
- Edge cases (detached HEAD, empty input, missing config, etc.)

## Acceptance criteria
Concrete tests that must pass. Format:
- [ ] Given X, when Y, then Z
- [ ] Given <edge case>, when Y, then <expected behavior>

## Out of scope
What this spec deliberately does NOT cover.

## Rollout
- Feature-flagged?
- Backward-compatibility implications
- Deprecation of any existing API
```

Specs become living docs — update as the feature evolves.
