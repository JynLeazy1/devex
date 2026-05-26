"use strict";
// Public entry point for the shared contracts.
//
// Two-language contract: the schemas defined here are mirrored in the Python
// CLI at `packages/cli/src/devex/contracts/`. The README in this directory
// documents the lockstep rules.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditEventSchema = exports.AuditActionSchema = exports.DoraEventSchema = exports.StatusSchema = exports.StageSchema = exports.BaseEventSchema = exports.SCHEMA_VERSION = void 0;
var _base_1 = require("./_base");
Object.defineProperty(exports, "SCHEMA_VERSION", { enumerable: true, get: function () { return _base_1.SCHEMA_VERSION; } });
Object.defineProperty(exports, "BaseEventSchema", { enumerable: true, get: function () { return _base_1.BaseEventSchema; } });
var dora_1 = require("./dora");
Object.defineProperty(exports, "StageSchema", { enumerable: true, get: function () { return dora_1.StageSchema; } });
Object.defineProperty(exports, "StatusSchema", { enumerable: true, get: function () { return dora_1.StatusSchema; } });
Object.defineProperty(exports, "DoraEventSchema", { enumerable: true, get: function () { return dora_1.DoraEventSchema; } });
var audit_1 = require("./audit");
Object.defineProperty(exports, "AuditActionSchema", { enumerable: true, get: function () { return audit_1.AuditActionSchema; } });
Object.defineProperty(exports, "AuditEventSchema", { enumerable: true, get: function () { return audit_1.AuditEventSchema; } });
