import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import * as adminApi from ".././adminApi";
import {
  RemovedAdminEndpointError,
  isRemovedAdminEndpointPath,
  redactAxiosErrorForLogs,
} from ".././api";

describe("admin endpoint hardening", () => {
  it("keeps only healthz admin API surface", () => {
    const exports = Object.keys(adminApi);
    expect(exports).toContain("fetchAdminHealthz");
    expect(exports.some((name) => /headers|token_manager|config/i.test(name))).toBe(false);
  });

  it("detects removed admin endpoint paths and allows healthz", () => {
    expect(isRemovedAdminEndpointPath("/admin")).toBe(true);
    expect(isRemovedAdminEndpointPath("/admin/")).toBe(true);
    expect(isRemovedAdminEndpointPath("/admin/headers/databricks")).toBe(true);
    expect(isRemovedAdminEndpointPath("/api/v1/admin")).toBe(true);
    expect(isRemovedAdminEndpointPath("/api/v1/admin/headers/sigma")).toBe(true);

    expect(isRemovedAdminEndpointPath("/admin/healthz")).toBe(false);
    expect(isRemovedAdminEndpointPath("/no-code/admin/domains")).toBe(false);
  });

  it("returns a typed feature-unavailable error for removed admin paths", () => {
    const error = new RemovedAdminEndpointError("/api/v1/admin/headers/sigma");
    expect(error.name).toBe("RemovedAdminEndpointError");
    expect(error.code).toBe("feature_unavailable");
    expect(error.status).toBe(404);
    expect(error.message).toBe("Feature unavailable.");
  });

  it("redacts authorization and token-like fields from axios errors before logging", () => {
    const error: any = {
      config: {
        headers: { Authorization: "Bearer abc123", "X-Workspace-Id": "ws-1" },
        data: { access_token: "abc", nested: { refresh_token: "def" } },
      },
      response: {
        data: { token: "ghi", message: "boom" },
      },
    };

    redactAxiosErrorForLogs(error);

    expect(error.config.headers.Authorization).toBe("[REDACTED]");
    expect(error.config.data.access_token).toBe("[REDACTED]");
    expect(error.config.data.nested.refresh_token).toBe("[REDACTED]");
    expect(error.response.data.token).toBe("[REDACTED]");
  });

  it("has no direct requests to removed admin endpoints", () => {
    const root = process.cwd();
    const files = [
      "src/shared/services/api.ts",
      "src/shared/services/adminApi.ts",
      "src/shared/services/queryStudioAdminApi.ts",
      "src/app/core/AuthBootstrap.tsx",
      "src/RootApp.tsx",
    ];

    const requestCallPattern = /api\.(?:get|post|put|patch|delete)\(\s*([`'\"])([^`'\"]+)\1/g;

    for (const file of files) {
      const source = readFileSync(path.join(root, file), "utf8");
      for (const match of source.matchAll(requestCallPattern)) {
        const endpoint = match[2];
        const normalized = endpoint.replace(/\/+$|\?.*$/g, "");

        expect(normalized).not.toBe("/admin");
        expect(normalized).not.toBe("/api/v1/admin");
        expect(normalized.startsWith("/admin/headers/")).toBe(false);
        expect(normalized.startsWith("/api/v1/admin/headers/")).toBe(false);
        expect(normalized.includes("/tenant-admin")).toBe(false);
        expect(normalized).not.toBe("/dashboards");
        expect(normalized).not.toBe("/api/v1/dashboards");
      }
    }
  });
});
