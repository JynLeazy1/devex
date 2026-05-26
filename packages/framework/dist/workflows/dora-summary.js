"use strict";
// doraSummaryJob — emits a single `DoraEvent` summarizing the pipeline run.
//
// Pipeline position: ALWAYS last. Uses `if: always()` so it runs even when
// upstream jobs fail — a failed pipeline still needs a DORA event (it counts
// toward Change Failure Rate).
// Language: INDEPENDENT — the event schema is the same across stacks.
Object.defineProperty(exports, "__esModule", { value: true });
exports.doraSummaryJob = void 0;
const lib_1 = require("@github-actions-workflow-ts/lib");
const dedent = (lines) => lines.join('\n');
function doraSummaryJob(profile) {
    const job = new lib_1.NormalJob('dora-summary', {
        'runs-on': 'ubuntu-latest',
        'timeout-minutes': 2,
        if: 'always()',
    });
    job.addStep(new lib_1.Step({
        name: 'Compose and emit DoraEvent',
        env: {
            PIPELINE_STATUS: "${{ contains(needs.*.result, 'failure') && 'failure' || (contains(needs.*.result, 'cancelled') && 'cancelled' || 'success') }}",
            WORK_ID_PATTERN: profile.workIdPattern,
            TEAM: profile.team,
            REPO: '${{ github.server_url }}/${{ github.repository }}',
            ACTOR: '${{ github.actor }}',
            GIT_SHA: '${{ github.sha }}',
            FRAMEWORK_VERSION: '0.1.0',
            SUBJECT: '${{ github.event.pull_request.title || github.head_ref || github.ref_name }}',
        },
        run: dedent([
            'WORK_ID=$(echo "$SUBJECT" | grep -oE "$WORK_ID_PATTERN" | head -1 || echo "UNKNOWN")',
            'TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)',
            'REASON_FIELD="null"',
            'if [ "$PIPELINE_STATUS" != "success" ]; then',
            '  REASON_FIELD="\\"pipeline reported $PIPELINE_STATUS via needs.*.result\\""',
            'fi',
            '',
            'EVENT=$(cat <<EOF',
            '{',
            '  "schema_version": "1.0",',
            '  "work_id": "$WORK_ID",',
            '  "team": "$TEAM",',
            '  "repo": "$REPO",',
            '  "stage": "dora-summary",',
            '  "status": "$PIPELINE_STATUS",',
            '  "actor": "$ACTOR",',
            '  "timestamp": "$TIMESTAMP",',
            '  "duration_ms": null,',
            '  "git_sha": "$GIT_SHA",',
            '  "framework_version": "$FRAMEWORK_VERSION",',
            '  "reason": $REASON_FIELD',
            '}',
            'EOF',
            ')',
            '',
            'echo "::group::DORA event"',
            'echo "$EVENT"',
            'echo "::endgroup::"',
            '',
            '# Surface the event as a workflow output so downstream jobs / org-wide',
            '# DORA collectors can pick it up. In production, replace this echo',
            '# with a POST to your collector endpoint:',
            '#   curl -fsS -X POST "$DORA_COLLECTOR_URL" \\',
            '#        -H "Content-Type: application/json" -d "$EVENT"',
            'echo "$EVENT" > dora-event.json',
        ]),
    }));
    job.addStep(new lib_1.Step({
        name: 'Upload DoraEvent artifact',
        uses: 'actions/upload-artifact@v4',
        if: 'always()',
        with: {
            name: `dora-event-${profile.serviceName}`,
            path: 'dora-event.json',
            'retention-days': 30,
        },
    }));
    return job;
}
exports.doraSummaryJob = doraSummaryJob;
