// TypeScript Lambda API profile — TYPE ONLY (workflow factories throw NotImplemented).
//
// Defined so consumers can see the polyglot contract and other teams can
// contribute the TS branch via inner-source PR. PoC scope intentionally
// excludes a full TypeScript implementation.

import type { BaseProfile } from './_base'

/**
 * Supported Lambda runtimes for TypeScript/Node services. Forces modern Node
 * (20 or 22); older runtimes (16, 18) are out of the Golden Path.
 */
export type NodeRuntime = 'nodejs20.x' | 'nodejs22.x'

/**
 * Supported package managers for TypeScript services. `pnpm` is the Golden
 * Path default (consistent with the framework itself); `npm` and `yarn` are
 * escape hatches for teams that haven't migrated.
 */
export type NodePackageManager = 'pnpm' | 'npm' | 'yarn'

export interface TypescriptLambdaProfile extends BaseProfile {
  readonly language: 'typescript'

  readonly runtime: NodeRuntime
  readonly packageManager: NodePackageManager

  /**
   * Path to the TypeScript source directory.
   */
  readonly sourcePath: string

  /**
   * Test command. Default convention: 'pnpm test'
   */
  readonly testCommand: string

  /**
   * Lint commands. Default convention: ['pnpm typecheck', 'pnpm lint']
   */
  readonly lintCommands: readonly string[]

  readonly openApiPath: string | null
  readonly minCoverage: number
}
