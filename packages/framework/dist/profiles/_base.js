"use strict";
// Stack profile — the polyglot abstraction.
//
// A `StackProfile` is a typed description of a team's language, runtime,
// package manager, and pipeline conventions. The framework's workflow factories
// (`smallTestsJob`, `cdkSynthJob`, ...) `switch` on the `language` discriminator
// to produce language-appropriate workflow steps.
//
// Adding a new language means:
//   1. Adding a new profile type extending BaseProfile with `language: 'newlang'`
//   2. Implementing the 5 workflow factory branches for that language
//
// PoC scope: PythonLambdaProfile is fully implemented. Go, TypeScript, and
// Clojure profiles are defined (typed) so consumers can see the contract, but
// their workflow factory branches throw `NotImplementedError` until D3/D4.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_WORK_ID_PATTERN = void 0;
/**
 * Framework-supplied default Work ID regex. **POSIX ERE compatible** — works
 * in:
 *   - JavaScript `new RegExp(DEFAULT_WORK_ID_PATTERN)`
 *   - Python `re.compile(DEFAULT_WORK_ID_PATTERN)`
 *   - bash `grep -qE "$DEFAULT_WORK_ID_PATTERN"`
 *
 * Matches: any uppercase prefix followed by `-` followed by digits.
 *   - 'FIN-123' ✓
 *   - 'ABC-9'   ✓
 *   - 'fin-123' ✗ (lowercase)
 *   - 'FIN'     ✗ (no dash + digits)
 *
 * Consumers can override `profile.workIdPattern` to be project-specific
 * (e.g., 'FIN-[0-9]+' for a single Jira project) but must stay POSIX-safe.
 */
exports.DEFAULT_WORK_ID_PATTERN = '[A-Z][A-Z0-9]*-[0-9]+';
