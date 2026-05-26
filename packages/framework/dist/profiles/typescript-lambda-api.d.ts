import type { BaseProfile } from './_base';
/**
 * Supported Lambda runtimes for TypeScript/Node services. Forces modern Node
 * (20 or 22); older runtimes (16, 18) are out of the Golden Path.
 */
export type NodeRuntime = 'nodejs20.x' | 'nodejs22.x';
/**
 * Supported package managers for TypeScript services. `pnpm` is the Golden
 * Path default (consistent with the framework itself); `npm` and `yarn` are
 * escape hatches for teams that haven't migrated.
 */
export type NodePackageManager = 'pnpm' | 'npm' | 'yarn';
export interface TypescriptLambdaProfile extends BaseProfile {
    readonly language: 'typescript';
    readonly runtime: NodeRuntime;
    readonly packageManager: NodePackageManager;
    /**
     * Path to the TypeScript source directory.
     */
    readonly sourcePath: string;
    /**
     * Test command. Default convention: 'pnpm test'
     */
    readonly testCommand: string;
    /**
     * Lint commands. Default convention: ['pnpm typecheck', 'pnpm lint']
     */
    readonly lintCommands: readonly string[];
    readonly openApiPath: string | null;
    readonly minCoverage: number;
}
//# sourceMappingURL=typescript-lambda-api.d.ts.map