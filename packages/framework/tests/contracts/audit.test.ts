import { AuditEventSchema, SCHEMA_VERSION } from '../../src/contracts'

const validEvent = {
  schema_version: SCHEMA_VERSION,
  work_id: 'FIN-456',
  team: 'transactionify',
  repo: 'https://github.com/org/transactionify',
  action: 'pr-merged',
  target: 'PR #123',
  actor: 'two-reviewer-bot',
  timestamp: '2026-05-23T15:00:00Z',
  reason: 'Merged after approvals by alice and bob (two-reviewer rule)',
  git_sha: 'deadbeef',
  framework_version: '0.1.0',
}

describe('AuditEventSchema', () => {
  it('accepts a well-formed event', () => {
    const parsed = AuditEventSchema.parse(validEvent)
    expect(parsed.action).toBe('pr-merged')
    expect(parsed.reason).toContain('two-reviewer')
  })

  it('rejects an empty reason (required by SOC 2)', () => {
    expect(() =>
      AuditEventSchema.parse({ ...validEvent, reason: '' }),
    ).toThrow(/reason must not be empty/)
  })

  it('rejects an unknown action', () => {
    expect(() =>
      AuditEventSchema.parse({ ...validEvent, action: 'secret-shenanigans' }),
    ).toThrow()
  })

  it('rejects an empty target', () => {
    expect(() =>
      AuditEventSchema.parse({ ...validEvent, target: '' }),
    ).toThrow(/target must not be empty/)
  })
})
