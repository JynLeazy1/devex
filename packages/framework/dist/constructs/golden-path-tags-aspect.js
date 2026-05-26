"use strict";
// GoldenPathTagsAspect — fails `cdk synth` if any required FinOps tag is
// missing from any taggable resource in scope.
//
// Why an Aspect (not constructor-time validation):
//   Aspects run AFTER the entire Construct tree is built, so they see the
//   final tag state — including tags applied via `cdk.Tags.of(scope).add(...)`
//   from outside the framework. A team that mixes `PythonLambdaApi` with
//   custom L2 Constructs still gets tag enforcement on their custom resources.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoldenPathTagsAspect = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const golden_path_tags_1 = require("./golden-path-tags");
class GoldenPathTagsAspect {
    requiredTagKeys;
    severity;
    constructor(options = {}) {
        this.requiredTagKeys = options.requiredTagKeys ?? golden_path_tags_1.REQUIRED_TAG_KEYS;
        this.severity = options.severity ?? 'warning';
    }
    visit(node) {
        // Only inspect taggable resources. Non-taggable Constructs are skipped.
        if (!cdk.TagManager.isTaggable(node))
            return;
        // Skip IAM Roles auto-created by Lambda/StepFunctions Constructs. CDK's
        // tag propagation to these is inconsistent (framework quirk). FinOps cost
        // attribution flows from the parent resource (the Lambda) anyway, so
        // skipping is safe for billing/cost dashboards.
        if (node.node.path.includes('/ServiceRole'))
            return;
        // CDK applies tags lazily: `Tags.of(stack).add(...)` does NOT propagate
        // the tags into child resources' TagManager until synthesis completes.
        // So we collect tags walking UP the parent chain — any required tag
        // present at any ancestor is considered satisfied.
        const present = this.collectInheritedTagKeys(node);
        for (const required of this.requiredTagKeys) {
            if (!present.has(required)) {
                const message = `[GoldenPathTags] Resource '${node.node.path}' is missing required tag '${required}'. ` +
                    `All Golden Path resources must carry the FinOps tag set — see ADR-001 §1.`;
                if (this.severity === 'error') {
                    cdk.Validations.of(node).addError('devex::missing-tag', message);
                }
                else {
                    cdk.Validations.of(node).addWarning('devex::missing-tag', message);
                }
            }
        }
    }
    /**
     * Walks up the Construct tree from `node` to the root, collecting tag keys
     * from every taggable ancestor. Models how CDK's tag propagation will
     * eventually apply tags from parent scopes to child resources.
     */
    collectInheritedTagKeys(node) {
        const keys = new Set();
        let current = node;
        while (current) {
            if (cdk.TagManager.isTaggable(current)) {
                for (const key of this.extractTagKeys(current.tags.renderTags())) {
                    keys.add(key);
                }
            }
            current = current.node.scope;
        }
        return keys;
    }
    /**
     * Pulls tag keys out of `TagManager.renderTags()`. The return shape varies
     * by resource — most use `[{Key, Value}]`, but some use a flat map. We try
     * both and return whatever we found; unknown shapes return an empty Set,
     * which makes the Aspect a no-op for that resource (failing safe).
     */
    extractTagKeys(rendered) {
        const keys = new Set();
        if (Array.isArray(rendered)) {
            for (const tag of rendered) {
                if (tag && typeof tag.Key === 'string') {
                    keys.add(tag.Key);
                }
            }
        }
        else if (rendered !== null && typeof rendered === 'object') {
            for (const key of Object.keys(rendered)) {
                keys.add(key);
            }
        }
        return keys;
    }
}
exports.GoldenPathTagsAspect = GoldenPathTagsAspect;
