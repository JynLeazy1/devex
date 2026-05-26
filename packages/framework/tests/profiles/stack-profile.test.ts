import {
  assertNever,
  isClojureProfile,
  isGoProfile,
  isPythonProfile,
  isTypescriptProfile,
  SUPPORTED_LANGUAGES,
  type ClojureLambdaProfile,
  type GoLambdaProfile,
  type PythonLambdaProfile,
  type StackProfile,
  type TypescriptLambdaProfile,
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
  testCommand: 'pytest --cov=src/python/transactionify --cov-fail-under=80',
  lintCommands: ['ruff check .', 'ruff format --check .', 'mypy src/python'],
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
  testCommand: 'go test -race -coverprofile=cov.out ./...',
  lintCommands: ['gofmt -l .', 'go vet ./...'],
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
  lintCommands: ['pnpm typecheck', 'pnpm lint'],
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
  lintCommands: ['clj-kondo --lint src'],
  openApiPath: null,
  minCoverage: 70,
}

describe('StackProfile', () => {
  describe('type guards', () => {
    it('isPythonProfile narrows correctly', () => {
      expect(isPythonProfile(pythonProfile)).toBe(true)
      expect(isPythonProfile(goProfile)).toBe(false)
    })

    it('isGoProfile narrows correctly', () => {
      expect(isGoProfile(goProfile)).toBe(true)
      expect(isGoProfile(pythonProfile)).toBe(false)
    })

    it('isTypescriptProfile narrows correctly', () => {
      expect(isTypescriptProfile(tsProfile)).toBe(true)
      expect(isTypescriptProfile(clojureProfile)).toBe(false)
    })

    it('isClojureProfile narrows correctly', () => {
      expect(isClojureProfile(clojureProfile)).toBe(true)
      expect(isClojureProfile(tsProfile)).toBe(false)
    })
  })

  describe('SUPPORTED_LANGUAGES', () => {
    it('lists exactly the four PoC languages', () => {
      expect([...SUPPORTED_LANGUAGES].sort()).toEqual(
        ['clojure', 'go', 'python', 'typescript'].sort(),
      )
    })
  })

  describe('exhaustiveness', () => {
    it('switch with all branches type-checks and runs', () => {
      function describe(profile: StackProfile): string {
        switch (profile.language) {
          case 'python':
            return `Python ${profile.runtime}`
          case 'go':
            return `Go ${profile.goVersion}`
          case 'typescript':
            return `Node ${profile.runtime}`
          case 'clojure':
            return `Clojure on ${profile.runtime}`
          default:
            assertNever(profile)
        }
      }

      expect(describe(pythonProfile)).toBe('Python 3.12')
      expect(describe(goProfile)).toBe('Go 1.22')
      expect(describe(tsProfile)).toBe('Node nodejs22.x')
      expect(describe(clojureProfile)).toBe('Clojure on java21')
    })

    it('assertNever throws if reached at runtime', () => {
      const bogus = { language: 'cobol' } as unknown as never
      expect(() => assertNever(bogus)).toThrow(/exhaustiveness check failed/)
    })
  })
})
