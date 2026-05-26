// StackProfile — the polyglot discriminated union.
//
// Consumers import `StackProfile` and pass language-specific profile objects
// to workflow factories and Constructs. The framework discriminates on the
// `language` field to produce language-appropriate output.
//
// PoC scope: PythonLambdaProfile is fully implemented. Go, TypeScript, and
// Clojure profiles are typed contracts; their workflow factory branches throw
// `NotImplementedError` at runtime.

import type { ClojureLambdaProfile } from './clojure-lambda-api'
import type { GoLambdaProfile } from './go-lambda-api'
import type { PythonLambdaProfile } from './python-lambda-api'
import type { TypescriptLambdaProfile } from './typescript-lambda-api'

export type { BaseProfile } from './_base'
export { DEFAULT_WORK_ID_PATTERN } from './_base'
export type {
  PythonLambdaProfile,
  PythonRuntime,
  PythonPackageManager,
} from './python-lambda-api'
export type { GoLambdaProfile, GoRuntime, GoVersion } from './go-lambda-api'
export type {
  TypescriptLambdaProfile,
  NodeRuntime,
  NodePackageManager,
} from './typescript-lambda-api'
export type {
  ClojureLambdaProfile,
  ClojurePackageManager,
  ClojureRuntime,
} from './clojure-lambda-api'

/**
 * The discriminated union of all supported StackProfiles.
 *
 * Use TypeScript's narrowing to handle each branch:
 *
 *   function describe(profile: StackProfile): string {
 *       switch (profile.language) {
 *           case 'python': return `Python ${profile.runtime}`
 *           case 'go': return `Go ${profile.goVersion}`
 *           case 'typescript': return `Node ${profile.runtime}`
 *           case 'clojure': return `Clojure on ${profile.runtime}`
 *       }
 *   }
 *
 * The compiler enforces exhaustive handling.
 */
export type StackProfile =
  | PythonLambdaProfile
  | GoLambdaProfile
  | TypescriptLambdaProfile
  | ClojureLambdaProfile

/**
 * The set of valid language discriminators. Useful for runtime validation
 * (e.g., when receiving a profile from a config file).
 */
export const SUPPORTED_LANGUAGES = [
  'python',
  'go',
  'typescript',
  'clojure',
] as const satisfies ReadonlyArray<StackProfile['language']>

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

/**
 * Type guard helpers — useful when narrowing at the boundary between
 * untyped JSON config and the typed framework.
 */
export function isPythonProfile(
  profile: StackProfile,
): profile is PythonLambdaProfile {
  return profile.language === 'python'
}

export function isGoProfile(profile: StackProfile): profile is GoLambdaProfile {
  return profile.language === 'go'
}

export function isTypescriptProfile(
  profile: StackProfile,
): profile is TypescriptLambdaProfile {
  return profile.language === 'typescript'
}

export function isClojureProfile(
  profile: StackProfile,
): profile is ClojureLambdaProfile {
  return profile.language === 'clojure'
}

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
export function assertNever(_x: never): never {
  throw new Error(
    'StackProfile exhaustiveness check failed — a new language was added ' +
      'to the union but its case is not handled.',
  )
}
