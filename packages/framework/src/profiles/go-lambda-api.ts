// Go Lambda API profile — TYPE ONLY (workflow factories throw NotImplemented).
//
// Defined so consumers can see the polyglot contract and other teams can
// contribute the Go branch via inner-source PR. PoC scope intentionally
// excludes a full Go implementation.

import type { BaseProfile } from './_base'

/**
 * Supported Go toolchain versions. Lambda runtimes for Go use the
 * `provided.al*` runtimes (Go binaries are cross-compiled and shipped).
 */
export type GoVersion = '1.21' | '1.22' | '1.23'

/**
 * Lambda runtime for Go services. Go binaries are statically compiled and
 * deployed against AWS's `provided.al*` runtimes — there is no "Go runtime"
 * provided by AWS, only a base image.
 */
export type GoRuntime = 'provided.al2023' | 'provided.al2'

export interface GoLambdaProfile extends BaseProfile {
  readonly language: 'go'

  readonly goVersion: GoVersion
  readonly runtime: GoRuntime

  /**
   * Path (relative to repo root) to the directory containing the service's
   * `go.mod`. The framework's workflow factories use this path as the working
   * directory for `go test`, `go build`, etc.
   *
   * Mirrors `sourcePath` on the Python/TypeScript profiles — the per-language
   * meaning differs slightly (Go needs a module root, not just a source dir),
   * but the contract is "where is the code I should build".
   */
  readonly sourcePath: string

  /**
   * Test command. Default convention: 'go test -race -coverprofile=cov.out ./...'
   */
  readonly testCommand: string

  /**
   * Lint commands. Default convention:
   *   ['gofmt -l .', 'go vet ./...', 'golangci-lint run']
   */
  readonly lintCommands: readonly string[]

  readonly openApiPath: string | null
  readonly minCoverage: number
}
