// Clojure Lambda API profile — TYPE ONLY (workflow factories throw NotImplemented).
//
// Defined so consumers can see the polyglot contract and other teams can
// contribute the Clojure branch via inner-source PR. PoC scope intentionally
// excludes a full Clojure implementation.

import type { BaseProfile } from './_base'

/**
 * "Package manager" for Clojure services. Unlike Python (`uv`/`pip`) or
 * TypeScript (`pnpm`/`npm`), Clojure tooling is broader than dependency
 * resolution — both `deps` and `lein` also orchestrate builds, run tests,
 * and manage REPLs. We use `packageManager` as the field name for
 * cross-language consistency in the framework's StackProfile contract;
 * read it as "the tool the framework invokes to install deps and run tasks".
 *
 * - `deps`: the modern `tools.deps` / `deps.edn` style (Clojure's built-in)
 * - `lein`: Leiningen, the older but still-popular build tool
 */
export type ClojurePackageManager = 'deps' | 'lein'

/**
 * Lambda runtime for Clojure services. Clojure compiles to JVM bytecode, so
 * it runs on one of AWS Lambda's Java runtimes.
 */
export type ClojureRuntime = 'java21' | 'java17'

export interface ClojureLambdaProfile extends BaseProfile {
  readonly language: 'clojure'

  readonly packageManager: ClojurePackageManager
  readonly runtime: ClojureRuntime

  /**
   * Path to the Clojure source directory.
   */
  readonly sourcePath: string

  /**
   * Test command. Default convention varies by package manager:
   *   - deps: 'clojure -X:test'
   *   - lein: 'lein test'
   */
  readonly testCommand: string

  readonly lintCommands: readonly string[]
  readonly openApiPath: string | null
  readonly minCoverage: number
}
