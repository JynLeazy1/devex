// workIdValidationJob — pre-flight validation that the branch, all commits,
// and the PR title carry a Work ID matching `profile.workIdPattern`.
//
// Pipeline position: FIRST job of the PR pipeline.
// Language: INDEPENDENT — same regex check for every stack profile.

import { NormalJob, Step } from '@github-actions-workflow-ts/lib'

import type { StackProfile } from '../profiles'

const dedent = (lines: readonly string[]): string => lines.join('\n')

export function workIdValidationJob(profile: StackProfile): NormalJob {
  const job = new NormalJob('work-id-validation', {
    'runs-on': 'ubuntu-latest',
    'timeout-minutes': 5,
  })

  job.addStep(
    new Step({
      name: 'Checkout (full history for commit walking)',
      uses: 'actions/checkout@v4',
      with: { 'fetch-depth': 0 },
    }),
  )

  job.addStep(
    new Step({
      name: 'Validate Work ID in branch name',
      env: {
        BRANCH: '${{ github.head_ref || github.ref_name }}',
        WORK_ID_PATTERN: profile.workIdPattern,
      },
      run: dedent([
        'if ! echo "$BRANCH" | grep -qE "$WORK_ID_PATTERN"; then',
        '  echo "::error::Branch \'$BRANCH\' is missing a Work ID matching pattern: $WORK_ID_PATTERN"',
        '  exit 1',
        'fi',
        'echo "Branch \'$BRANCH\' has Work ID"',
      ]),
    }),
  )

  job.addStep(
    new Step({
      name: 'Validate Work ID in PR commits',
      if: "github.event_name == 'pull_request'",
      env: {
        WORK_ID_PATTERN: profile.workIdPattern,
        BASE_SHA: '${{ github.event.pull_request.base.sha }}',
        HEAD_SHA: '${{ github.event.pull_request.head.sha }}',
      },
      run: dedent([
        'BAD=$(git log --format="%H %s" "$BASE_SHA..$HEAD_SHA" | grep -vE "$WORK_ID_PATTERN" || true)',
        'if [ -n "$BAD" ]; then',
        '  echo "::error::Commits missing Work ID matching $WORK_ID_PATTERN:"',
        '  echo "$BAD"',
        '  exit 1',
        'fi',
        'echo "All commits have Work ID"',
      ]),
    }),
  )

  job.addStep(
    new Step({
      name: 'Validate Work ID in PR title',
      if: "github.event_name == 'pull_request'",
      env: {
        PR_TITLE: '${{ github.event.pull_request.title }}',
        WORK_ID_PATTERN: profile.workIdPattern,
      },
      run: dedent([
        'if ! echo "$PR_TITLE" | grep -qE "$WORK_ID_PATTERN"; then',
        '  echo "::error::PR title is missing Work ID matching: $WORK_ID_PATTERN"',
        '  echo "Title: $PR_TITLE"',
        '  exit 1',
        'fi',
        'echo "PR title has Work ID"',
      ]),
    }),
  )

  return job
}
