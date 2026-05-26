"use strict";
// StackProfile — the polyglot discriminated union.
//
// Consumers import `StackProfile` and pass language-specific profile objects
// to workflow factories and Constructs. The framework discriminates on the
// `language` field to produce language-appropriate output.
//
// PoC scope: PythonLambdaProfile is fully implemented. Go, TypeScript, and
// Clojure profiles are typed contracts; their workflow factory branches throw
// `NotImplementedError` at runtime.
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertNever = exports.isClojureProfile = exports.isTypescriptProfile = exports.isGoProfile = exports.isPythonProfile = exports.SUPPORTED_LANGUAGES = exports.DEFAULT_WORK_ID_PATTERN = void 0;
var _base_1 = require("./_base");
Object.defineProperty(exports, "DEFAULT_WORK_ID_PATTERN", { enumerable: true, get: function () { return _base_1.DEFAULT_WORK_ID_PATTERN; } });
/**
 * The set of valid language discriminators. Useful for runtime validation
 * (e.g., when receiving a profile from a config file).
 */
exports.SUPPORTED_LANGUAGES = [
    'python',
    'go',
    'typescript',
    'clojure',
];
/**
 * Type guard helpers — useful when narrowing at the boundary between
 * untyped JSON config and the typed framework.
 */
function isPythonProfile(profile) {
    return profile.language === 'python';
}
exports.isPythonProfile = isPythonProfile;
function isGoProfile(profile) {
    return profile.language === 'go';
}
exports.isGoProfile = isGoProfile;
function isTypescriptProfile(profile) {
    return profile.language === 'typescript';
}
exports.isTypescriptProfile = isTypescriptProfile;
function isClojureProfile(profile) {
    return profile.language === 'clojure';
}
exports.isClojureProfile = isClojureProfile;
/**
 * Exhaustiveness helper. Use in `switch` statements to guarantee at compile
 * time that every language is handled:
 *
 *   switch (profile.language) {
 *       case 'python': return doPython(profile)
 *       case 'go':     return doGo(profile)
 *       case 'typescript': return doTs(profile)
 *       case 'clojure': return doClojure(profile)
 *       default: assertNever(profile)
 *   }
 *
 * If a new language is added to the union without a `case`, the compiler
 * flags the call to `assertNever`.
 */
function assertNever(_x) {
    throw new Error('StackProfile exhaustiveness check failed — a new language was added ' +
        'to the union but its case is not handled.');
}
exports.assertNever = assertNever;
