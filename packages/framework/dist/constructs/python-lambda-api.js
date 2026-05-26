"use strict";
// PythonLambdaApi — L3 Construct that provisions an entire Python Lambda
// API stack (HTTP API + DynamoDB + authorizer + N routes).
//
// Replaces a transactionify-shaped 188-line monolithic Stack with one ~10-line
// declaration. The L3 holds the opinionated Golden Path: single-table DynamoDB
// (PK/SK + TTL), HTTP API v2, optional Lambda authorizer, FinOps tag aspect.
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
exports.PythonLambdaApi = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const apigwv2 = __importStar(require("aws-cdk-lib/aws-apigatewayv2"));
const apigwv2_authorizers = __importStar(require("aws-cdk-lib/aws-apigatewayv2-authorizers"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const constructs_1 = require("constructs");
const golden_path_tags_aspect_1 = require("./golden-path-tags-aspect");
const python_lambda_route_1 = require("./python-lambda-route");
const PYTHON_RUNTIME_MAP = {
    '3.11': lambda.Runtime.PYTHON_3_11,
    '3.12': lambda.Runtime.PYTHON_3_12,
};
/** Default table partition key name (matches transactionify's single-table pattern). */
const DEFAULT_PARTITION_KEY = 'PK';
const DEFAULT_SORT_KEY = 'SK';
const DEFAULT_TTL_ATTRIBUTE = 'ttl';
/** Defaults for `extraGrants` Lambdas — mirror PythonLambdaRoute defaults. */
const EXTRA_GRANT_DEFAULT_MEMORY_MB = 256;
const EXTRA_GRANT_DEFAULT_TIMEOUT_SECONDS = 10;
class PythonLambdaApi extends constructs_1.Construct {
    httpApi;
    table;
    authorizer;
    routes;
    /**
     * Lambdas created via `props.extraGrants`, keyed by `grant.id`. Use to
     * attach event sources, IAM grants beyond table access, or to reference
     * the function in CfnOutputs.
     */
    extraGrantLambdas;
    constructor(scope, id, props) {
        super(scope, id);
        // 1. Apply Golden Path FinOps tags to the entire subtree. The
        //    GoldenPathTagsAspect (next step) validates these reach every
        //    taggable resource at synth time.
        for (const [key, value] of Object.entries(props.tags)) {
            cdk.Tags.of(this).add(key, value);
        }
        // 2. Register the tag-enforcement Aspect at READONLY priority so it runs
        //    AFTER CDK's built-in Tag-propagation aspects (which are MUTATING,
        //    priority 200). Without this, our aspect races the tag propagation
        //    and reports false negatives on resources whose tags haven't been
        //    pushed down yet. Severity defaults to 'warning' inside the Aspect
        //    when `props.tagSeverity` is omitted.
        cdk.Aspects.of(this).add(new golden_path_tags_aspect_1.GoldenPathTagsAspect({ severity: props.tagSeverity }), { priority: cdk.AspectPriority.READONLY });
        // 3. Single-table DynamoDB (matches transactionify's pattern).
        this.table = this.createTable(props);
        // 4. HTTP API v2 (cheaper than REST v1, matches transactionify).
        this.httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
            apiName: `${props.serviceName}-api`,
            createDefaultStage: true,
        });
        // 5. Authorizer Lambda (optional). When null, the API is fully public.
        this.authorizer = this.createAuthorizer(props);
        // 6. Per-route Constructs — one PythonLambdaRoute per RouteDefinition.
        this.routes = props.routes.map((route, index) => {
            // Stable, debuggable IDs: e.g., 'Route0', 'Route1', ...
            // (Logical IDs are append-only — never renumber after deployment.)
            return new python_lambda_route_1.PythonLambdaRoute(this, `Route${index}`, {
                httpApi: this.httpApi,
                table: this.table,
                sourcePath: props.sourcePath,
                runtime: props.runtime,
                route,
                authorizer: this.authorizer,
            });
        });
        // 7. Extra grants — non-route Lambdas that share the table. The L3 owns
        //    their creation + table grant; consumers attach event sources (e.g.,
        //    EventBridge, SQS) after construction via the `extraGrantLambdas` map.
        const extraGrantLambdas = new Map();
        for (const grant of props.extraGrants ?? []) {
            if (extraGrantLambdas.has(grant.id)) {
                throw new Error(`PythonLambdaApi: duplicate extraGrant id '${grant.id}'. ` +
                    'Each extraGrant.id must be unique within the Construct.');
            }
            const fn = new lambda.Function(this, grant.id, {
                runtime: PYTHON_RUNTIME_MAP[props.runtime],
                handler: grant.handler,
                code: lambda.Code.fromAsset(props.sourcePath),
                memorySize: grant.memorySize ?? EXTRA_GRANT_DEFAULT_MEMORY_MB,
                timeout: cdk.Duration.seconds(grant.timeoutSeconds ?? EXTRA_GRANT_DEFAULT_TIMEOUT_SECONDS),
                ...(grant.description !== undefined ? { description: grant.description } : {}),
                environment: { TABLE_NAME: this.table.tableName },
            });
            (0, python_lambda_route_1.grantTableAccess)(this.table, fn, grant.permission);
            extraGrantLambdas.set(grant.id, fn);
        }
        this.extraGrantLambdas = extraGrantLambdas;
        // 8. CloudFormation outputs — mirrors transactionify's behavior.
        new cdk.CfnOutput(this, 'ApiUrl', {
            value: this.httpApi.apiEndpoint,
            description: 'HTTP API Gateway endpoint URL',
        });
        new cdk.CfnOutput(this, 'TableName', {
            value: this.table.tableName,
            description: 'DynamoDB table name',
        });
    }
    createTable(props) {
        const cfg = props.tableConfig ?? {};
        const partitionKeyName = cfg.partitionKeyName ?? DEFAULT_PARTITION_KEY;
        const sortKeyName = cfg.sortKeyName === null ? null : (cfg.sortKeyName ?? DEFAULT_SORT_KEY);
        const ttlAttributeName = cfg.ttlAttributeName === null
            ? undefined
            : (cfg.ttlAttributeName ?? DEFAULT_TTL_ATTRIBUTE);
        return new dynamodb.Table(this, 'Table', {
            partitionKey: { name: partitionKeyName, type: dynamodb.AttributeType.STRING },
            ...(sortKeyName !== null
                ? { sortKey: { name: sortKeyName, type: dynamodb.AttributeType.STRING } }
                : {}),
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            ...(ttlAttributeName !== undefined ? { timeToLiveAttribute: ttlAttributeName } : {}),
        });
    }
    createAuthorizer(props) {
        if (props.authorizerHandler === null) {
            return null;
        }
        const authorizerLambda = new lambda.Function(this, 'AuthorizerLambda', {
            runtime: PYTHON_RUNTIME_MAP[props.runtime],
            handler: props.authorizerHandler,
            code: lambda.Code.fromAsset(props.sourcePath),
            environment: {
                TABLE_NAME: this.table.tableName,
            },
        });
        this.table.grantReadData(authorizerLambda);
        return new apigwv2_authorizers.HttpLambdaAuthorizer('Authorizer', authorizerLambda, {
            identitySource: ['$request.header.Authorization'],
            resultsCacheTtl: cdk.Duration.minutes(0),
            responseTypes: [apigwv2_authorizers.HttpLambdaResponseType.SIMPLE],
        });
    }
}
exports.PythonLambdaApi = PythonLambdaApi;
