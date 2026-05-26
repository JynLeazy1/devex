import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import type { PythonLambdaRouteProps } from './props';
export declare class PythonLambdaRoute extends Construct {
    /**
     * The Lambda function backing this route. Exposed so consumers can grant
     * additional permissions, hook event sources, or override resource policy.
     */
    readonly lambdaFunction: lambda.Function;
    constructor(scope: Construct, id: string, props: PythonLambdaRouteProps);
}
//# sourceMappingURL=python-lambda-route.d.ts.map