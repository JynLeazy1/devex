// Workflow factory behavior tests.
//
// For implemented factories (workIdValidationJob, cdkSynthJob), we verify the
// shape and content of the generated NormalJob.
//
// For still-stubbed factories (contractValidationJob, doraSummaryJob,
// smallTestsJob), we verify they throw the documented `not implemented` /
// `out of PoC scope` errors with the expected wording.

import {
  cdkSynthJob,
  contractValidationJob,
  doraSummaryJob,
  integrationPromoteJob,
  smallTestsJob,
  workIdValidationJob,
} from '../../src/workflows'
import type {
  ClojureLambdaProfile,
  GoLambdaProfile,
  PythonLambdaProfile,
  TypescriptLambdaProfile,
} from '../../src/profiles'

const pythonProfile: PythonLambdaProfile = {
  language: 'python',
  serviceName: 'transactionify',
  team: 'transactionify',
  repoUrl: 'https://github.com/org/transactionify',
  workIdPattern: 'FIN-\\d+',
  awsRegion: 'us-east-1',
  runtime: '3.12',
  packageManager: 'uv',
  sourcePath: 'src/python',
  testCommand: 'pytest',
  lintCommands: ['ruff check .'],
  openApiPath: 'openapi.yaml',
  minCoverage: 80,
}

const goProfile: GoLambdaProfile = {
  language: 'go',
  serviceName: 'goservice',
  team: 'platform',
  repoUrl: 'https://github.com/org/goservice',
  workIdPattern: 'GO-\\d+',
  awsRegion: 'us-east-1',
  goVersion: '1.22',
  runtime: 'provided.al2023',
  sourcePath: '.',
  testCommand: 'go test ./...',
  lintCommands: [],
  openApiPath: null,
  minCoverage: 70,
}

const tsProfile: TypescriptLambdaProfile = {
  language: 'typescript',
  serviceName: 'tsservice',
  team: 'frontend-infra',
  repoUrl: 'https://github.com/org/tsservice',
  workIdPattern: 'TS-\\d+',
  awsRegion: 'us-east-1',
  runtime: 'nodejs22.x',
  packageManager: 'pnpm',
  sourcePath: 'src',
  testCommand: 'pnpm test',
  lintCommands: [],
  openApiPath: null,
  minCoverage: 75,
}

const clojureProfile: ClojureLambdaProfile = {
  language: 'clojure',
  serviceName: 'cljservice',
  team: 'data-platform',
  repoUrl: 'https://github.com/org/cljservice',
  workIdPattern: 'DATA-\\d+',
  awsRegion: 'us-east-1',
  packageManager: 'deps',
  runtime: 'java21',
  sourcePath: 'src',
  testCommand: 'clojure -X:test',
  lintCommands: [],
  openApiPath: null,
  minCoverage: 70,
}

describe('workIdValidationJob (implemented)', () => {
  const job = workIdValidationJob(pythonProfile)

  it('has stable job name', () => {
    expect(job.name).toBe('work-id-validation')
  })

  it('runs on ubuntu-latest with a 5-minute timeout', () => {
    expect(job.job['runs-on']).toBe('ubuntu-latest')
    expect(job.job['timeout-minutes']).toBe(5)
  })

  it('starts with a full-history checkout (needed to walk commits)', () => {
    const checkout = job.job.steps?.[0]
    expect(checkout?.uses).toBe('actions/checkout@v4')
    expect(checkout?.with?.['fetch-depth']).toBe(0)
  })

  it('has 4 steps: checkout + branch + commits + PR title', () => {
    expect(job.job.steps).toHaveLength(4)
  })

  it('embeds the profile.workIdPattern into the validation steps', () => {
    const stepEnvs = (job.job.steps ?? []).flatMap((s) =>
      s.env ? Object.values(s.env) : [],
    )
    expect(stepEnvs).toContain(pythonProfile.workIdPattern)
  })

  it('PR-specific steps are gated by `github.event_name == pull_request`', () => {
    const conditionalSteps = (job.job.steps ?? []).filter((s) => s.if)
    expect(conditionalSteps.length).toBeGreaterThanOrEqual(2)
    for (const step of conditionalSteps) {
      expect(step.if).toMatch(/pull_request/)
    }
  })

  it('respects the org-specific Work ID regex from the profile', () => {
    const customProfile: PythonLambdaProfile = {
      ...pythonProfile,
      workIdPattern: 'CUSTOM-[0-9]+',
    }
    const customJob = workIdValidationJob(customProfile)
    const envs = (customJob.job.steps ?? []).flatMap((s) =>
      s.env ? Object.values(s.env) : [],
    )
    expect(envs).toContain('CUSTOM-[0-9]+')
  })
})

describe('cdkSynthJob (implemented)', () => {
  const job = cdkSynthJob(pythonProfile)

  it('has stable job name', () => {
    expect(job.name).toBe('cdk-synth')
  })

  it('runs on ubuntu-latest with a 10-minute timeout', () => {
    expect(job.job['runs-on']).toBe('ubuntu-latest')
    expect(job.job['timeout-minutes']).toBe(10)
  })

  it('has 6 steps: checkout + pnpm + node + install + synth + upload', () => {
    expect(job.job.steps).toHaveLength(6)
  })

  it('installs Node, pnpm, and runs cdk synth in that order', () => {
    const stepNames = (job.job.steps ?? []).map((s) => s.name)
    const checkoutIdx = stepNames.findIndex((n) => n?.includes('Checkout'))
    const pnpmIdx = stepNames.findIndex((n) => n?.includes('Setup pnpm'))
    const nodeIdx = stepNames.findIndex((n) => n?.includes('Setup Node'))
    const installIdx = stepNames.findIndex((n) => n?.includes('Install'))
    const synthIdx = stepNames.findIndex((n) => n?.includes('cdk synth'))

    expect(checkoutIdx).toBeLessThan(pnpmIdx)
    expect(pnpmIdx).toBeLessThan(nodeIdx)
    expect(nodeIdx).toBeLessThan(installIdx)
    expect(installIdx).toBeLessThan(synthIdx)
  })

  it('uploads the synthesized CFN template as an artifact', () => {
    const upload = (job.job.steps ?? []).find((s) =>
      s.uses?.startsWith('actions/upload-artifact'),
    )
    expect(upload).toBeDefined()
    expect(upload?.with?.path).toMatch(/cdk\.out/)
  })

  it('artifact name embeds the service name', () => {
    const upload = (job.job.steps ?? []).find((s) =>
      s.uses?.startsWith('actions/upload-artifact'),
    )
    expect(upload?.with?.name).toContain('transactionify')
  })

  it('passes AWS_REGION from the profile to the synth step', () => {
    const synth = (job.job.steps ?? []).find((s) =>
      s.name?.includes('cdk synth'),
    )
    const env = synth?.env as Record<string, string> | undefined
    expect(env?.AWS_REGION).toBe(pythonProfile.awsRegion)
  })
})

describe('contractValidationJob (implemented)', () => {
  describe('with openApiPath set', () => {
    const job = contractValidationJob(pythonProfile)

    it('has stable job name', () => {
      expect(job.name).toBe('contract-validation')
    })

    it('has 5 steps: checkout + setup-python + install + validate + upload', () => {
      expect(job.job.steps).toHaveLength(5)
    })

    it('uses setup-python (not setup-uv) for the validator', () => {
      const setup = (job.job.steps ?? []).find((s) =>
        s.uses?.startsWith('actions/setup-python'),
      )
      expect(setup).toBeDefined()
      const setupWith = setup?.with as Record<string, unknown> | undefined
      expect(setupWith?.cache).toBe('pip')
    })

    it('runs openapi-spec-validator against the configured spec path', () => {
      const validate = (job.job.steps ?? []).find((s) =>
        s.name?.includes('Validate OpenAPI'),
      )
      expect(validate?.run).toContain('openapi-spec-validator')
      expect(validate?.run).toContain(pythonProfile.openApiPath ?? '')
    })

    it('uploads the spec as an artifact even on failure', () => {
      const upload = (job.job.steps ?? []).find((s) =>
        s.uses?.startsWith('actions/upload-artifact'),
      )
      expect(upload).toBeDefined()
      expect(upload?.if).toBe('always()')
      expect(upload?.with?.name).toContain(pythonProfile.serviceName)
    })
  })

  describe('with openApiPath === null', () => {
    const noSpecProfile = { ...pythonProfile, openApiPath: null }
    const job = contractValidationJob(noSpecProfile)

    it('emits a single skip step (no validator run)', () => {
      expect(job.job.steps).toHaveLength(1)
      const step = job.job.steps?.[0]
      expect(step?.name).toMatch(/Skip/i)
      expect(step?.run).toContain('skipping')
    })

    it('does not install Python or the validator', () => {
      const usesList = (job.job.steps ?? [])
        .map((s) => s.uses)
        .filter((u): u is string => typeof u === 'string')
      expect(usesList).toHaveLength(0)
    })
  })
})

describe('doraSummaryJob (implemented)', () => {
  const job = doraSummaryJob(pythonProfile)

  it('has stable job name', () => {
    expect(job.name).toBe('dora-summary')
  })

  it('runs always() so failing pipelines still produce a DORA event', () => {
    expect(job.job.if).toBe('always()')
  })

  it('has 2 steps: emit + upload artifact', () => {
    expect(job.job.steps).toHaveLength(2)
  })

  it('embeds the profile work_id pattern, team, and framework version', () => {
    const emit = job.job.steps?.[0]
    const env = emit?.env as Record<string, string> | undefined
    expect(env?.WORK_ID_PATTERN).toBe(pythonProfile.workIdPattern)
    expect(env?.TEAM).toBe(pythonProfile.team)
    expect(env?.FRAMEWORK_VERSION).toMatch(/\d+\.\d+\.\d+/)
  })

  it('aggregates needs.*.result into PIPELINE_STATUS', () => {
    const emit = job.job.steps?.[0]
    const env = emit?.env as Record<string, string> | undefined
    expect(env?.PIPELINE_STATUS).toMatch(/needs\.\*\.result/)
    expect(env?.PIPELINE_STATUS).toMatch(/failure/)
  })

  it('uploads the dora-event.json artifact with always() guard', () => {
    const upload = job.job.steps?.[1]
    expect(upload?.uses).toMatch(/upload-artifact/)
    expect(upload?.if).toBe('always()')
    expect(upload?.with?.path).toBe('dora-event.json')
  })

  it('emits a JSON shape matching DoraEventSchema keys', () => {
    const emit = job.job.steps?.[0]
    const run = String(emit?.run ?? '')
    for (const key of [
      'schema_version',
      'work_id',
      'team',
      'repo',
      'stage',
      'status',
      'actor',
      'timestamp',
      'duration_ms',
      'git_sha',
      'framework_version',
      'reason',
    ]) {
      expect(run).toContain(`"${key}"`)
    }
  })
})

describe('smallTestsJob (implemented for python)', () => {
  describe('python branch', () => {
    const job = smallTestsJob(pythonProfile)

    it('has stable job name', () => {
      expect(job.name).toBe('small-tests')
    })

    it('sets up uv with the profile-declared Python runtime', () => {
      const setup = (job.job.steps ?? []).find((s) =>
        s.uses?.startsWith('astral-sh/setup-uv'),
      )
      expect(setup).toBeDefined()
      const setupWith = setup?.with as Record<string, unknown> | undefined
      expect(setupWith?.['python-version']).toBe(pythonProfile.runtime)
      expect(setupWith?.['enable-cache']).toBe(true)
    })

    it('uv cache-dependency-glob covers uv.lock, pyproject.toml, requirements.txt', () => {
      const setup = (job.job.steps ?? []).find((s) =>
        s.uses?.startsWith('astral-sh/setup-uv'),
      )
      const setupWith = setup?.with as Record<string, unknown> | undefined
      const glob = String(setupWith?.['cache-dependency-glob'] ?? '')
      expect(glob).toContain('**/uv.lock')
      expect(glob).toContain('**/pyproject.toml')
      expect(glob).toContain('**/requirements.txt')
    })

    it('installs deps via `uv sync` when packageManager is uv', () => {
      const install = (job.job.steps ?? []).find((s) =>
        s.name?.includes('Install'),
      )
      expect(install?.run).toContain('uv sync')
      expect(install?.['working-directory']).toBe(pythonProfile.sourcePath)
    })

    it('uv install fallback creates a venv and exports it via $GITHUB_PATH', () => {
      const install = (job.job.steps ?? []).find((s) =>
        s.name?.includes('Install'),
      )
      expect(install?.run).toContain('[ -f uv.lock ]')
      expect(install?.run).toContain('uv venv')
      expect(install?.run).toContain('uv pip install -r requirements.txt')
      expect(install?.run).toContain('$GITHUB_PATH')
    })

    it('uses `pip install -r requirements.txt` when packageManager is pip', () => {
      const pipJob = smallTestsJob({
        ...pythonProfile,
        packageManager: 'pip',
      })
      const install = (pipJob.job.steps ?? []).find((s) =>
        s.name?.includes('Install'),
      )
      expect(install?.run).toContain('pip install')
      expect(install?.run).toContain('requirements.txt')
    })

    it('uses setup-python (not setup-uv) when packageManager is pip', () => {
      const pipJob = smallTestsJob({
        ...pythonProfile,
        packageManager: 'pip',
      })
      const usesList = (pipJob.job.steps ?? [])
        .map((s) => s.uses)
        .filter((u): u is string => typeof u === 'string')

      expect(usesList).toContain('actions/setup-python@v5')
      expect(usesList).not.toContain('astral-sh/setup-uv@v4')

      const setupPython = (pipJob.job.steps ?? []).find((s) =>
        s.uses?.startsWith('actions/setup-python'),
      )
      const setupWith = setupPython?.with as Record<string, unknown> | undefined
      expect(setupWith?.['python-version']).toBe(pythonProfile.runtime)
      expect(setupWith?.cache).toBe('pip')
    })

    it('runs the profile.testCommand verbatim', () => {
      const tests = (job.job.steps ?? []).find((s) => s.name === 'Run tests')
      expect(tests?.run).toBe(pythonProfile.testCommand)
    })

    it('runs profile.lintCommands before tests when non-empty', () => {
      const multiLintJob = smallTestsJob({
        ...pythonProfile,
        lintCommands: ['ruff check src', 'ruff format --check src'],
      })
      const steps = multiLintJob.job.steps ?? []
      const lintIdx = steps.findIndex((s) => s.name === 'Run lint')
      const testIdx = steps.findIndex((s) => s.name === 'Run tests')
      expect(lintIdx).toBeGreaterThanOrEqual(0)
      expect(lintIdx).toBeLessThan(testIdx)
      const lint = steps[lintIdx]
      // All lintCommands present, joined with `&&` for fail-fast
      expect(lint.run).toContain('ruff check src')
      expect(lint.run).toContain('ruff format --check src')
      expect(lint.run).toContain(' && ')
    })

    it('omits the lint step when profile.lintCommands is empty', () => {
      const noLintJob = smallTestsJob({ ...pythonProfile, lintCommands: [] })
      const lint = (noLintJob.job.steps ?? []).find((s) => s.name === 'Run lint')
      expect(lint).toBeUndefined()
    })

    it('uploads coverage when --cov is in the testCommand', () => {
      const covJob = smallTestsJob({
        ...pythonProfile,
        testCommand: 'pytest --cov=src/python/transactionify --cov-fail-under=80',
      })
      const upload = (covJob.job.steps ?? []).find((s) =>
        s.uses?.startsWith('actions/upload-artifact'),
      )
      expect(upload).toBeDefined()
      expect(upload?.if).toBe('always()')
      expect(upload?.with?.name).toContain(pythonProfile.serviceName)
    })

    it('omits the coverage upload when --cov is NOT in the testCommand', () => {
      const noCovJob = smallTestsJob({
        ...pythonProfile,
        testCommand: 'pytest',
      })
      const upload = (noCovJob.job.steps ?? []).find((s) =>
        s.uses?.startsWith('actions/upload-artifact'),
      )
      expect(upload).toBeUndefined()
    })
  })

  describe('other languages — still out of PoC scope', () => {
    it('throws "out of PoC scope" for Go/TS/Clojure', () => {
      for (const profile of [goProfile, tsProfile, clojureProfile]) {
        expect(() => smallTestsJob(profile)).toThrow(/out of the PoC scope/i)
      }
    })

    it('mentions the specific language in out-of-scope messages', () => {
      expect(() => smallTestsJob(goProfile)).toThrow(/'go' branch/i)
      expect(() => smallTestsJob(tsProfile)).toThrow(/'typescript' branch/i)
      expect(() => smallTestsJob(clojureProfile)).toThrow(/'clojure' branch/i)
    })
  })
})

describe('integrationPromoteJob (deferred skeleton)', () => {
  it('throws "out of PoC scope" for every environment', () => {
    for (const env of ['sandbox', 'staging', 'prod'] as const) {
      expect(() => integrationPromoteJob(pythonProfile, env)).toThrow(
        /out of the PoC scope/i,
      )
    }
  })

  it('mentions the specific environment in the error message', () => {
    expect(() => integrationPromoteJob(pythonProfile, 'sandbox')).toThrow(
      /'sandbox'/,
    )
    expect(() => integrationPromoteJob(pythonProfile, 'prod')).toThrow(/'prod'/)
  })
})
