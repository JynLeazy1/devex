// EnvironmentConfig — the typed contract that consumer stacks pass to
// PythonLambdaApi to declare which environment they're deploying to.
//
// The framework does NOT read AWS account/region from CDK context. Consumers
// pass them explicitly via this object. This keeps the Constructs testable
// (no implicit state) and forces the consumer to be deliberate about
// environment configuration.

/**
 * The deployment stages supported by the Golden Path Integration Pipeline.
 *
 * PoC scope: only `sandbox` is used by the implemented Constructs (because the
 * Integration Pipeline is deferred). The full set is declared so the consumer
 * code is forward-compatible.
 */
export type Stage = 'sandbox' | 'staging' | 'prod'

/**
 * Monitoring tier. Drives CloudWatch alarm thresholds, log retention, and
 * X-Ray sampling rates. The framework picks sensible defaults per tier so
 * consumers don't have to think about it.
 *
 * - `basic`:    1-week log retention, no alarms (suitable for `sandbox`)
 * - `enhanced`: 1-month log retention, latency + error alarms (suitable for `staging`/`prod`)
 */
export type MonitoringTier = 'basic' | 'enhanced'

export interface EnvironmentConfig {
  readonly stage: Stage
  readonly account: string
  readonly region: string
  readonly monitoring: MonitoringTier
}
