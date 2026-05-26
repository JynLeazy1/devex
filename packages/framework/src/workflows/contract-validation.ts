// contractValidationJob — validates the OpenAPI spec at `profile.openApiPath`.
//
// Pipeline position: AFTER small-tests.
// Language: INDEPENDENT — uses `openapi-spec-validator` (Python) against the spec
// file itself. Future enhancement (Integration Pipeline scope): spin up the API
// and run `schemathesis` for actual conformance testing against a live service.
//
// Behavior:
//   - If profile.openApiPath is null: emit a job that exits 0 with a "skipped"
//     message — services without an OpenAPI spec opt out cleanly.
//   - Otherwise: setup-python + pip install openapi-spec-validator + validate.

import { NormalJob, Step } from '@github-actions-workflow-ts/lib'

import type { StackProfile } from '../profiles'

export function contractValidationJob(profile: StackProfile): NormalJob {
  const job = new NormalJob('contract-validation', {
    'runs-on': 'ubuntu-latest',
    'timeout-minutes': 5,
  })

  if (profile.openApiPath === null) {
    job.addStep(
      new Step({
        name: 'Skip — no OpenAPI spec configured',
        run:
          'echo "::notice::profile.openApiPath is null; skipping contract validation."',
      }),
    )
    return job
  }

  const specPath = profile.openApiPath

  job.addStep(new Step({ name: 'Checkout', uses: 'actions/checkout@v4' }))

  job.addStep(
    new Step({
      name: 'Setup Python',
      uses: 'actions/setup-python@v5',
      with: {
        'python-version': '3.12',
        cache: 'pip',
      },
    }),
  )

  job.addStep(
    new Step({
      name: 'Install openapi-spec-validator',
      run: 'pip install --quiet openapi-spec-validator>=0.7',
    }),
  )

  job.addStep(
    new Step({
      name: 'Validate OpenAPI spec',
      run: `openapi-spec-validator ${specPath}`,
    }),
  )

  job.addStep(
    new Step({
      name: 'Upload OpenAPI spec for review',
      uses: 'actions/upload-artifact@v4',
      if: 'always()',
      with: {
        name: `openapi-${profile.serviceName}`,
        path: specPath,
        'retention-days': 7,
      },
    }),
  )

  return job
}
