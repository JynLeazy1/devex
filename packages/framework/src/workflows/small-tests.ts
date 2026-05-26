// smallTestsJob — runs the language-specific unit + property-based tests,
// with coverage enforcement.
//
// Pipeline position: AFTER work-id-validation.
// Language: DEPENDENT. Only the `python` branch is implemented in the PoC;
// other languages are typed contracts that throw `out of PoC scope`.

import { NormalJob, Step } from '@github-actions-workflow-ts/lib'

import {
  assertNever,
  type PythonLambdaProfile,
  type StackProfile,
} from '../profiles'

const OUT_OF_POC_SCOPE = (language: string): string =>
  `smallTestsJob: '${language}' branch is out of the PoC scope. ` +
  'Implementable via inner-source contribution — see CONTRIBUTING.md.'

export function smallTestsJob(profile: StackProfile): NormalJob {
  switch (profile.language) {
    case 'python':
      return smallTestsJobPython(profile)
    case 'go':
    case 'typescript':
    case 'clojure':
      throw new Error(OUT_OF_POC_SCOPE(profile.language))
    default:
      assertNever(profile)
  }
}

function smallTestsJobPython(profile: PythonLambdaProfile): NormalJob {
  const job = new NormalJob('small-tests', {
    'runs-on': 'ubuntu-latest',
    'timeout-minutes': 10,
  })

  job.addStep(new Step({ name: 'Checkout', uses: 'actions/checkout@v4' }))

  // Each package manager gets its idiomatic setup action: setup-uv caches
  // ~/.cache/uv/ and provides a native uv binary; setup-python caches the
  // pip wheel directory and exposes pip natively.
  if (profile.packageManager === 'uv') {
    job.addStep(
      new Step({
        name: 'Setup uv',
        uses: 'astral-sh/setup-uv@v4',
        with: {
          'python-version': profile.runtime,
          'enable-cache': true,
          // setup-uv@v4 defaults `cache-dependency-glob` to `**/uv.lock` and
          // hard-errors when no file matches. Many real consumers don't have
          // a committed uv.lock yet (e.g., transactionify-style repos still on
          // requirements.txt). Listing all common Python deps files keeps the
          // cache key stable AND keeps the action from failing the run.
          'cache-dependency-glob': [
            '**/uv.lock',
            '**/pyproject.toml',
            '**/requirements.txt',
          ].join('\n'),
        },
      }),
    )
  } else {
    job.addStep(
      new Step({
        name: 'Setup Python',
        uses: 'actions/setup-python@v5',
        with: {
          'python-version': profile.runtime,
          cache: 'pip',
        },
      }),
    )
  }

  // For uv, prefer `uv sync --frozen` (deterministic from uv.lock) but fall
  // back to creating a venv and installing requirements.txt when the consumer
  // hasn't migrated to a lockfile yet. We can't use --system on stock Ubuntu
  // runners (PEP 668 marker + read-only /usr/local), so a venv is the only
  // robust path. Push `.venv/bin` into `$GITHUB_PATH` so the next step
  // (running `pytest`) picks up the binaries without needing `uv run`.
  const installRun =
    profile.packageManager === 'uv'
      ? 'if [ -f uv.lock ]; then uv sync --frozen; else uv venv && uv pip install -r requirements.txt; fi && echo "$PWD/.venv/bin" >> "$GITHUB_PATH"'
      : 'pip install -r requirements.txt'

  job.addStep(
    new Step({
      name: `Install Python dependencies (${profile.packageManager})`,
      'working-directory': profile.sourcePath,
      run: installRun,
    }),
  )

  if (profile.lintCommands.length > 0) {
    job.addStep(
      new Step({
        name: 'Run lint',
        run: profile.lintCommands.join(' && '),
      }),
    )
  }

  // AWS_DEFAULT_REGION is required when any imported module instantiates a
  // boto3 client at import time (common pattern in Python Lambdas). We prefer
  // a GitHub Actions repo Variable (`vars.AWS_DEFAULT_REGION`) so consumers
  // can override per-env without touching the workflow; the fallback is the
  // profile's `awsRegion` so a freshly-scaffolded repo without the Variable
  // configured still passes CI.
  job.addStep(
    new Step({
      name: 'Run tests',
      env: {
        PYTHONPATH: profile.sourcePath,
        AWS_DEFAULT_REGION: `\${{ vars.AWS_DEFAULT_REGION || '${profile.awsRegion}' }}`,
      },
      run: profile.testCommand,
    }),
  )

  if (profile.testCommand.includes('--cov')) {
    job.addStep(
      new Step({
        name: 'Upload coverage report',
        uses: 'actions/upload-artifact@v4',
        if: 'always()',
        with: {
          name: `coverage-${profile.serviceName}`,
          path: 'coverage.xml',
          'retention-days': 7,
        },
      }),
    )
  }

  return job
}
