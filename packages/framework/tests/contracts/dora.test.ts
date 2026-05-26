import { DoraEventSchema, SCHEMA_VERSION } from '../../src/contracts'

const validEvent = {
  schema_version: SCHEMA_VERSION,
  work_id: 'FIN-123',
  team: 'transactionify',
  repo: 'https://github.com/org/transactionify',
  stage: 'small-tests',
  status: 'success',
  actor: 'jorge.flores',
  timestamp: '2026-05-23T14:32:11Z',
  duration_ms: 47213,
  git_sha: 'abc1234',
  framework_version: '0.1.0',
  reason: null,
}

describe('DoraEventSchema', () => {
  it('accepts a well-formed event', () => {
    const parsed = DoraEventSchema.parse(validEvent)
    expect(parsed.work_id).toBe('FIN-123')
    expect(parsed.stage).toBe('small-tests')
  })

  it('rejects an invalid Work ID format', () => {
    expect(() =>
      DoraEventSchema.parse({ ...validEvent, work_id: 'fin-123' }),
    ).toThrow(/PREFIX-123/)
  })

  it('rejects an unknown stage', () => {
    expect(() =>
      DoraEventSchema.parse({ ...validEvent, stage: 'super-secret-stage' }),
    ).toThrow()
  })

  it('rejects a non-ISO timestamp', () => {
    expect(() =>
      DoraEventSchema.parse({ ...validEvent, timestamp: '2026-05-23 14:32:11' }),
    ).toThrow(/ISO-8601/)
  })

  it('rejects a non-hex git_sha', () => {
    expect(() =>
      DoraEventSchema.parse({ ...validEvent, git_sha: 'not-a-sha' }),
    ).toThrow()
  })

  it('rejects a negative duration', () => {
    expect(() =>
      DoraEventSchema.parse({ ...validEvent, duration_ms: -1 }),
    ).toThrow()
  })

  it('accepts duration_ms = null (for `started` events)', () => {
    const parsed = DoraEventSchema.parse({
      ...validEvent,
      status: 'started',
      duration_ms: null,
    })
    expect(parsed.duration_ms).toBeNull()
  })

  it('rejects a missing required field', () => {
    const { reason, ...incomplete } = validEvent
    expect(() => DoraEventSchema.parse(incomplete)).toThrow()
  })

  it('rejects a wrong schema_version', () => {
    expect(() =>
      DoraEventSchema.parse({ ...validEvent, schema_version: '0.9' }),
    ).toThrow()
  })
})
