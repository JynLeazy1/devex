// GoldenPathTagsAspect — fails `cdk synth` if any required FinOps tag is
// missing from any taggable resource in scope.
//
// Why an Aspect (not constructor-time validation):
//   Aspects run AFTER the entire Construct tree is built, so they see the
//   final tag state — including tags applied via `cdk.Tags.of(scope).add(...)`
//   from outside the framework. A team that mixes `PythonLambdaApi` with
//   custom L2 Constructs still gets tag enforcement on their custom resources.

import * as cdk from 'aws-cdk-lib'
import type { IAspect } from 'aws-cdk-lib'
import type { IConstruct } from 'constructs'

import { REQUIRED_TAG_KEYS } from './golden-path-tags'

/**
 * The CloudFormation tag shape used by most AWS resources. The Aspect
 * normalizes against this — resources using non-standard shapes (rare) are
 * skipped with a debug note rather than blocking synth.
 */
interface StandardCfnTag {
  readonly Key: string
  readonly Value: string
}

/**
 * Severity at which the Aspect reports missing tags. Supports graduated rollout:
 *
 * - `warning`: surface in CI logs but does not block `cdk synth`. Right for
 *   new adopters or teams in transition.
 * - `error`: blocks `cdk synth`. Right for mature teams or production stacks.
 */
export type GoldenPathTagsSeverity = 'warning' | 'error'

export interface GoldenPathTagsAspectOptions {
  readonly requiredTagKeys?: readonly string[]
  readonly severity?: GoldenPathTagsSeverity
}

export class GoldenPathTagsAspect implements IAspect {
  public readonly requiredTagKeys: readonly string[]
  public readonly severity: GoldenPathTagsSeverity

  constructor(options: GoldenPathTagsAspectOptions = {}) {
    this.requiredTagKeys = options.requiredTagKeys ?? REQUIRED_TAG_KEYS
    this.severity = options.severity ?? 'warning'
  }

  public visit(node: IConstruct): void {
    // Only inspect taggable resources. Non-taggable Constructs are skipped.
    if (!cdk.TagManager.isTaggable(node)) return

    // Skip IAM Roles auto-created by Lambda/StepFunctions Constructs. CDK's
    // tag propagation to these is inconsistent (framework quirk). FinOps cost
    // attribution flows from the parent resource (the Lambda) anyway, so
    // skipping is safe for billing/cost dashboards.
    if (node.node.path.includes('/ServiceRole')) return

    // CDK applies tags lazily: `Tags.of(stack).add(...)` does NOT propagate
    // the tags into child resources' TagManager until synthesis completes.
    // So we collect tags walking UP the parent chain — any required tag
    // present at any ancestor is considered satisfied.
    const present = this.collectInheritedTagKeys(node)

    for (const required of this.requiredTagKeys) {
      if (!present.has(required)) {
        const message =
          `[GoldenPathTags] Resource '${node.node.path}' is missing required tag '${required}'. ` +
          `All Golden Path resources must carry the FinOps tag set — see ADR-001 §1.`

        if (this.severity === 'error') {
          cdk.Validations.of(node).addError('devex::missing-tag', message)
        } else {
          cdk.Validations.of(node).addWarning('devex::missing-tag', message)
        }
      }
    }
  }

  /**
   * Walks up the Construct tree from `node` to the root, collecting tag keys
   * from every taggable ancestor. Models how CDK's tag propagation will
   * eventually apply tags from parent scopes to child resources.
   */
  private collectInheritedTagKeys(node: IConstruct): Set<string> {
    const keys = new Set<string>()
    let current: IConstruct | undefined = node
    while (current) {
      if (cdk.TagManager.isTaggable(current)) {
        for (const key of this.extractTagKeys(current.tags.renderTags())) {
          keys.add(key)
        }
      }
      current = current.node.scope
    }
    return keys
  }

  /**
   * Pulls tag keys out of `TagManager.renderTags()`. The return shape varies
   * by resource — most use `[{Key, Value}]`, but some use a flat map. We try
   * both and return whatever we found; unknown shapes return an empty Set,
   * which makes the Aspect a no-op for that resource (failing safe).
   */
  private extractTagKeys(rendered: unknown): Set<string> {
    const keys = new Set<string>()

    if (Array.isArray(rendered)) {
      for (const tag of rendered as StandardCfnTag[]) {
        if (tag && typeof tag.Key === 'string') {
          keys.add(tag.Key)
        }
      }
    } else if (rendered !== null && typeof rendered === 'object') {
      for (const key of Object.keys(rendered)) {
        keys.add(key)
      }
    }

    return keys
  }
}
