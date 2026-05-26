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

  const installRun =
    profile.packageManager === 'uv'
      ? 'uv sync --frozen'
      : 'pip install -r requirements.txt'

  job.addStep(
    new Step({
      name: `Install Python dependencies (${profile.packageManager})`,
      'working-directory': profile.sourcePath,
      run: installRun,
    }),
  )

  job.addStep(
    new Step({
      name: 'Run tests',
      env: { PYTHONPATH: profile.sourcePath },
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
