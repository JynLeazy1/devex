"use strict";
// Public entry point for Constructs and their type contracts.
//
// Implementation of the actual Constructs is added incrementally:
//   D2.5 — class skeletons (this exports them once they exist)
//   D3   — full implementation
//
// What's exported now: only the types/interfaces consumers need to declare
// their props. Construct classes are added below as they land.
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoldenPathTagsAspect = exports.PythonLambdaRoute = exports.PythonLambdaApi = exports.REQUIRED_TAG_KEYS = void 0;
var golden_path_tags_1 = require("./golden-path-tags");
Object.defineProperty(exports, "REQUIRED_TAG_KEYS", { enumerable: true, get: function () { return golden_path_tags_1.REQUIRED_TAG_KEYS; } });
// Construct classes — skeleton in D2.5, full implementation in D3
var python_lambda_api_1 = require("./python-lambda-api");
Object.defineProperty(exports, "PythonLambdaApi", { enumerable: true, get: function () { return python_lambda_api_1.PythonLambdaApi; } });
var python_lambda_route_1 = require("./python-lambda-route");
Object.defineProperty(exports, "PythonLambdaRoute", { enumerable: true, get: function () { return python_lambda_route_1.PythonLambdaRoute; } });
var golden_path_tags_aspect_1 = require("./golden-path-tags-aspect");
Object.defineProperty(exports, "GoldenPathTagsAspect", { enumerable: true, get: function () { return golden_path_tags_aspect_1.GoldenPathTagsAspect; } });
