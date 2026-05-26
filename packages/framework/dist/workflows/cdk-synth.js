"use strict";
// cdkSynthJob — runs `cdk synth` to validate that infrastructure code
// compiles to a valid CloudFormation template, without deploying.
//
// Pipeline position: AFTER contract-validation. Last gate before the
// Integration Pipeline.
// Language: INDEPENDENT — CDK is always TypeScript, regardless of Lambda runtime.
//
// CRITICAL: this is where `GoldenPathTagsAspect` fires. Missing FinOps tags
// surface here as `cdk synth` warnings (or errors when `severity: 'error'`).
Object.defineProperty(exports, "__esModule", { value: true });
exports.cdkSynthJob = void 0;
const lib_1 = require("@github-actions-workflow-ts/lib");
function cdkSynthJob(profile) {
    const job = new lib_1.NormalJob('cdk-synth', {
        'runs-on': 'ubuntu-latest',
        'timeout-minutes': 10,
    });
    job.addStep(new lib_1.Step({
        name: 'Checkout',
        uses: 'actions/checkout@v4',
    }));
    job.addStep(new lib_1.Step({
        name: 'Setup pnpm',
        uses: 'pnpm/action-setup@v4',
        with: { version: '9', run_install: 'false' },
    }));
    job.addStep(new lib_1.Step({
        name: 'Setup Node',
        uses: 'actions/setup-node@v4',
        with: { 'node-version': '20', cache: 'pnpm' },
    }));
    job.addStep(new lib_1.Step({
        name: 'Install dependencies',
        run: 'pnpm install --frozen-lockfile',
    }));
    job.addStep(new lib_1.Step({
        name: 'Run cdk synth',
        env: { AWS_REGION: profile.awsRegion },
        run: 'pnpm cdk synth',
    }));
    job.addStep(new lib_1.Step({
        name: 'Upload CloudFormation template',
        uses: 'actions/upload-artifact@v4',
        if: 'always()',
        with: {
            name: `cdk-template-${profile.serviceName}`,
            path: 'cdk.out/*.template.json',
            'retention-days': 7,
        },
    }));
    return job;
}
exports.cdkSynthJob = cdkSynthJob;
