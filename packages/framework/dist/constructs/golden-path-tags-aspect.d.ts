import type { IAspect } from 'aws-cdk-lib';
import type { IConstruct } from 'constructs';
/**
 * Severity at which the Aspect reports missing tags. Supports graduated rollout:
 *
 * - `warning`: surface in CI logs but does not block `cdk synth`. Right for
 *   new adopters or teams in transition.
 * - `error`: blocks `cdk synth`. Right for mature teams or production stacks.
 */
export type GoldenPathTagsSeverity = 'warning' | 'error';
export interface GoldenPathTagsAspectOptions {
    readonly requiredTagKeys?: readonly string[];
    readonly severity?: GoldenPathTagsSeverity;
}
export declare class GoldenPathTagsAspect implements IAspect {
    readonly requiredTagKeys: readonly string[];
    readonly severity: GoldenPathTagsSeverity;
    constructor(options?: GoldenPathTagsAspectOptions);
    visit(node: IConstruct): void;
    /**
     * Walks up the Construct tree from `node` to the root, collecting tag keys
     * from every taggable ancestor. Models how CDK's tag propagation will
     * eventually apply tags from parent scopes to child resources.
     */
    private collectInheritedTagKeys;
    /**
     * Pulls tag keys out of `TagManager.renderTags()`. The return shape varies
     * by resource — most use `[{Key, Value}]`, but some use a flat map. We try
     * both and return whatever we found; unknown shapes return an empty Set,
     * which makes the Aspect a no-op for that resource (failing safe).
     */
    private extractTagKeys;
}
//# sourceMappingURL=golden-path-tags-aspect.d.ts.map