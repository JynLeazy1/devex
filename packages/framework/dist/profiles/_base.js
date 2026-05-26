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
