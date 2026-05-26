// Regression test for `DEFAULT_WORK_ID_PATTERN` portability across all three
// regex engines it has to pass through (PR #2 of JynLeazy1/transactionify
// caught this the hard way: `\d+` worked in JS/Python but not in bash POSIX
// ERE, so CI rejected legitimate Work IDs).

import { execSync } from 'node:child_process'
import { DEFAULT_WORK_ID_PATTERN } from '../../src/profiles'

const POSITIVE = ['FIN-123', 'ABC-9', 'JIRA-9999', 'DATA-1', 'A-0', 'KAN-42']
const NEGATIVE = ['fin-123', 'FIN', 'FIN-', '123', 'FIN_123', '-123', 'fin']

describe('DEFAULT_WORK_ID_PATTERN portability', () => {
  it('compiles to a valid JavaScript RegExp', () => {
    expect(() => new RegExp(DEFAULT_WORK_ID_PATTERN)).not.toThrow()
  })

  it('matches expected positives in JavaScript RegExp', () => {
    const re = new RegExp(`^(${DEFAULT_WORK_ID_PATTERN})$`)
    for (const id of POSITIVE) {
      expect(re.test(id)).toBe(true)
    }
  })

  it('rejects expected negatives in JavaScript RegExp', () => {
    const re = new RegExp(`^(${DEFAULT_WORK_ID_PATTERN})$`)
    for (const id of NEGATIVE) {
      expect(re.test(id)).toBe(false)
    }
  })

  // POSIX ERE check via bash grep — exact same path the workflow YAML uses.
  // Skipped if grep isn't available (e.g., Windows without WSL).
  const grepAvailable = (() => {
    try {
      execSync('grep --version', { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  })()

  ;(grepAvailable ? it : it.skip)(
    'matches positives in bash `grep -qE` (POSIX ERE)',
    () => {
      for (const id of POSITIVE) {
        const code = execSync(
          `printf "%s" "${id}" | grep -qE "${DEFAULT_WORK_ID_PATTERN}"; echo $?`,
        )
          .toString()
          .trim()
        expect(code).toBe('0')
      }
    },
  )

  ;(grepAvailable ? it : it.skip)(
    'rejects negatives in bash `grep -qE` (POSIX ERE)',
    () => {
      for (const id of NEGATIVE) {
        const code = execSync(
          `printf "%s" "${id}" | grep -qE "${DEFAULT_WORK_ID_PATTERN}"; echo $?`,
        )
          .toString()
          .trim()
        expect(code).toBe('1')
      }
    },
  )

  it('does NOT contain `\\d`, `\\w`, or `\\s` (JS/Python only, fails POSIX ERE)', () => {
    expect(DEFAULT_WORK_ID_PATTERN).not.toMatch(/\\[dws]/)
  })
})
