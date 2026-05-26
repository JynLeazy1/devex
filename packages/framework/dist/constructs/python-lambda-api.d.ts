import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwv2_authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import type { PythonLambdaApiProps } from './props';
import { PythonLambdaRoute } from './python-lambda-route';
export declare class PythonLambdaApi extends Construct {
    readonly httpApi: apigwv2.HttpApi;
    readonly table: dynamodb.Table;
    readonly authorizer: apigwv2_authorizers.HttpLambdaAuthorizer | null;
    readonly routes: readonly PythonLambdaRoute[];
    constructor(scope: Construct, id: string, props: PythonLambdaApiProps);
    private createTable;
    private createAuthorizer;
}
//# sourceMappingURL=python-lambda-api.d.ts.map