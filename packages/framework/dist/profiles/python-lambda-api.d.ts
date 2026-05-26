import type { BaseProfile } from './_base';
/**
 * Supported Python runtime versions. The Golden Path forces a modern runtime
 * (3.11 or 3.12) to keep all services on a maintained interpreter.
 *
 * Note: AWS Lambda still allows older runtimes (3.9, 3.10). The framework
 * deliberately excludes them — adopting the framework means upgrading.
 */
export type PythonRuntime = '3.11' | '3.12';
/**
 * Supported Python package managers. `uv` is the preferred Golden Path choice
 * (matches the org's `devex` CLI). `pip` is allowed as an escape hatch for
 * teams that haven't migrated yet.
 */
export type PythonPackageManager = 'uv' | 'pip';
/**
 * Profile for services built as Python Lambdas behind API Gateway v2.
 *
 * Matches the architecture of the reference project `transactionify`:
 * monolithic Lambda code bundle, single-table DynamoDB, HTTP API.
 */
export interface PythonLambdaProfile extends BaseProfile {
    readonly language: 'python';
    readonly runtime: PythonRuntime;
    readonly packageManager: PythonPackageManager;
    /**
     * Path (relative to repo root) to the Python source directory passed to
     * `lambda.Code.fromAsset(...)`. Mirrors transactionify's `src/python`.
     */
    readonly sourcePath: string;
    /**
     * Test command run in the `smallTestsJob` workflow. Should run the full
     * unit + property-based suite and emit a coverage report.
     *
     * Example: 'pytest --cov=src/python/<pkg> --cov-fail-under=80'
     */
    readonly testCommand: string;
    /**
     * Lint and format check commands. Run sequentially in the workflow's lint
     * stage. Each command must exit non-zero on violations.
     *
     * Example: ['ruff check .', 'ruff format --check .', 'mypy src/python', 'uv run lint', 'black --check src/python']
     */
    readonly lintCommands: readonly string[];
    /**
     * Path to the OpenAPI spec used by `contractValidationJob`. The spec is
     * validated against the deployed (or locally-emulated) API.
     *
     * If null, contract validation is skipped for this service.
     */
    readonly openApiPath: string | null;
    /**
     * Minimum test coverage percent that the PR pipeline enforces.
     * 0 means no enforcement (not recommended).
     */
    readonly minCoverage: number;
}
//# sourceMappingURL=python-lambda-api.d.ts.map