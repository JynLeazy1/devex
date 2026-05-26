import type { RoutePermission } from './route-definition';
export interface ExtraGrant {
    /**
     * CDK construct id for the Lambda. Used as the suffix of the logical id
     * inside the parent `PythonLambdaApi` scope (e.g., `'Provisioning'` →
     * `Api/Provisioning`). Must be unique within the parent scope.
     */
    readonly id: string;
    /**
     * Python handler in `module.path:function_name` notation, e.g.
     * `'transactionify.handlers.provisioning.main.handler'`.
     */
    readonly handler: string;
    /**
     * Permission this Lambda needs against the shared DynamoDB table. Reuses
     * `RoutePermission` so the surface is one familiar concept: `'read'`,
     * `'write'`, or `'readwrite'`. Granted via `table.grant*Data(fn)`.
     */
    readonly permission: RoutePermission;
    /**
     * Free-form description set on the Lambda. Surfaces in the AWS console
     * and useful for distinguishing internal Lambdas from route Lambdas.
     */
    readonly description?: string;
    /**
     * Memory size in MB. Defaults to the Golden Path default (256 MB).
     */
    readonly memorySize?: number;
    /**
     * Timeout in seconds. Defaults to the Golden Path default (10 s).
     */
    readonly timeoutSeconds?: number;
}
//# sourceMappingURL=extra-grant.d.ts.map