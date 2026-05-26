import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import type { PythonLambdaRouteProps } from './props';
import type { RoutePermission } from './route-definition';
/**
 * Applies the route's declared DynamoDB permission to a Lambda. Permission
 * declarations in `RouteDefinition` are kept narrow (`read`/`write`/`readwrite`)
 * so handlers cannot accidentally get broader access than they declared.
 *
 * Exported so `PythonLambdaApi` can reuse it for `extraGrants` Lambdas.
 */
export declare function grantTableAccess(table: {
    grantReadData: (fn: lambda.IFunction) => unknown;
    grantWriteData: (fn: lambda.IFunction) => unknown;
    grantReadWriteData: (fn: lambda.IFunction) => unknown;
}, fn: lambda.IFunction, permission: RoutePermission): void;
export declare class PythonLambdaRoute extends Construct {
    /**
     * The Lambda function backing this route. Exposed so consumers can grant
     * additional permissions, hook event sources, or override resource policy.
     */
    readonly lambdaFunction: lambda.Function;
    constructor(scope: Construct, id: string, props: PythonLambdaRouteProps);
}
//# sourceMappingURL=python-lambda-route.d.ts.map