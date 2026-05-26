import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwv2_authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import type { PythonLambdaApiProps } from './props';
import { PythonLambdaRoute } from './python-lambda-route';
export declare class PythonLambdaApi extends Construct {
    readonly httpApi: apigwv2.HttpApi;
    readonly table: dynamodb.Table;
    readonly authorizer: apigwv2_authorizers.HttpLambdaAuthorizer | null;
    readonly routes: readonly PythonLambdaRoute[];
    /**
     * Lambdas created via `props.extraGrants`, keyed by `grant.id`. Use to
     * attach event sources, IAM grants beyond table access, or to reference
     * the function in CfnOutputs.
     */
    readonly extraGrantLambdas: ReadonlyMap<string, lambda.Function>;
    constructor(scope: Construct, id: string, props: PythonLambdaApiProps);
    private createTable;
    private createAuthorizer;
}
//# sourceMappingURL=python-lambda-api.d.ts.map