"use strict";
// PythonLambdaRoute — L2 Construct that provisions one HTTP endpoint backed
// by a Python Lambda.
//
// Replaces the 15-line repeated pattern from transactionify's monolithic
// stack (lambda.Function + grant + HttpLambdaIntegration + addRoutes) with
// a single typed Construct.
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
exports.PythonLambdaRoute = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const apigwv2 = __importStar(require("aws-cdk-lib/aws-apigatewayv2"));
const apigwv2_integrations = __importStar(require("aws-cdk-lib/aws-apigatewayv2-integrations"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const constructs_1 = require("constructs");
const profiles_1 = require("../profiles");
/** Default Lambda memory in MB. Tuned for typical Python handlers. */
const DEFAULT_MEMORY_MB = 256;
/** Default Lambda timeout in seconds. Forces sane upper bound on cold paths. */
const DEFAULT_TIMEOUT_SECONDS = 10;
// TODO(post-PoC): set `logRetention: logs.RetentionDays.ONE_MONTH` and
// `tracing: lambda.Tracing.ACTIVE` once we move to explicit `logGroup` Construct
// (CDK deprecated `logRetention` because it spawns a custom resource).
/**
 * Maps our `PythonRuntime` string to the CDK enum. Type-safe — adding a new
 * runtime to the union without updating this map is a compile error.
 */
const PYTHON_RUNTIME_MAP = {
    '3.11': lambda.Runtime.PYTHON_3_11,
    '3.12': lambda.Runtime.PYTHON_3_12,
};
/**
 * Maps our `HttpMethod` string union to the CDK enum.
 */
const HTTP_METHOD_MAP = {
    GET: apigwv2.HttpMethod.GET,
    POST: apigwv2.HttpMethod.POST,
    PUT: apigwv2.HttpMethod.PUT,
    PATCH: apigwv2.HttpMethod.PATCH,
    DELETE: apigwv2.HttpMethod.DELETE,
};
/**
 * Applies the route's declared DynamoDB permission to a Lambda. Permission
 * declarations in `RouteDefinition` are kept narrow (`read`/`write`/`readwrite`)
 * so handlers cannot accidentally get broader access than they declared.
 */
function grantTableAccess(table, fn, permission) {
    switch (permission) {
        case 'read':
            table.grantReadData(fn);
            return;
        case 'write':
            table.grantWriteData(fn);
            return;
        case 'readwrite':
            table.grantReadWriteData(fn);
            return;
        default:
            (0, profiles_1.assertNever)(permission);
    }
}
class PythonLambdaRoute extends constructs_1.Construct {
    /**
     * The Lambda function backing this route. Exposed so consumers can grant
     * additional permissions, hook event sources, or override resource policy.
     */
    lambdaFunction;
    constructor(scope, id, props) {
        super(scope, id);
        const { route, runtime, sourcePath, table, httpApi, authorizer } = props;
        // 1. Create the Lambda function with Golden Path defaults.
        this.lambdaFunction = new lambda.Function(this, 'Fn', {
            runtime: PYTHON_RUNTIME_MAP[runtime],
            handler: route.handler,
            code: lambda.Code.fromAsset(sourcePath),
            memorySize: route.memorySize ?? DEFAULT_MEMORY_MB,
            timeout: cdk.Duration.seconds(route.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS),
            environment: {
                TABLE_NAME: table.tableName,
            },
        });
        // 2. Grant the declared DynamoDB permission — narrow by default.
        grantTableAccess(table, this.lambdaFunction, route.permission);
        // 3. Wire the Lambda to the HTTP API as an integration + route.
        const integration = new apigwv2_integrations.HttpLambdaIntegration('Integration', this.lambdaFunction);
        const shouldAuth = route.requiresAuth !== false;
        httpApi.addRoutes({
            path: route.path,
            methods: [HTTP_METHOD_MAP[route.method]],
            integration,
            ...(shouldAuth && authorizer ? { authorizer } : {}),
        });
    }
}
exports.PythonLambdaRoute = PythonLambdaRoute;
