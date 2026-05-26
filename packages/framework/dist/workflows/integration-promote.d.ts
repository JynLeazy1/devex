import { NormalJob } from '@github-actions-workflow-ts/lib';
import type { StackProfile } from '../profiles';
export type IntegrationEnvironment = 'sandbox' | 'staging' | 'prod';
export declare function integrationPromoteJob(_profile: StackProfile, env: IntegrationEnvironment): NormalJob;
//# sourceMappingURL=integration-promote.d.ts.map