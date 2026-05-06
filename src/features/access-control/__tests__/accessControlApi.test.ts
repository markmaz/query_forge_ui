import { describe, expect, it } from "vitest";
import { buildEffectiveAccessSummary } from "../api";
import type { WorkspaceFeatureEntitlement, WorkspaceRoleAssignment } from "../types";

describe("buildEffectiveAccessSummary", () => {
  it("marks disabled features as blocked even when a feature role exists", () => {
    const assignments: WorkspaceRoleAssignment[] = [
      {
        assignment_id: "1",
        user_id: "u1",
        workspace_id: "ws1",
        role_id: "r1",
        role_key: "skills:admin",
        role_name: "skills:admin",
        display_name: "Skills Admin",
        category: "feature",
        feature_key: "skills",
        access_level: "admin",
        source: "direct",
        created_at: null,
        updated_at: null,
      },
    ];

    const features: WorkspaceFeatureEntitlement[] = [
      {
        workspace_id: "ws1",
        feature_key: "skills",
        enabled: false,
        updated_at: null,
        updated_by: null,
        note: null,
      },
    ];

    const summary = buildEffectiveAccessSummary(assignments, features);
    const skills = summary.find((entry) => entry.feature_key === "skills");

    expect(skills).toMatchObject({
      status: "blocked_feature",
      access_level: "none",
      assigned_role_key: "skills:admin",
    });
  });

  it("elevates enabled features through workspace_admin", () => {
    const assignments: WorkspaceRoleAssignment[] = [
      {
        assignment_id: "1",
        user_id: "u1",
        workspace_id: "ws1",
        role_id: "r1",
        role_key: "workspace_admin",
        role_name: "workspace_admin",
        display_name: "Workspace Admin",
        category: "workspace",
        feature_key: null,
        access_level: "admin",
        source: "direct",
        created_at: null,
        updated_at: null,
      },
    ];

    const features: WorkspaceFeatureEntitlement[] = [
      {
        workspace_id: "ws1",
        feature_key: "forge_match",
        enabled: true,
        updated_at: null,
        updated_by: null,
        note: null,
      },
    ];

    const summary = buildEffectiveAccessSummary(assignments, features);
    const forgeMatch = summary.find((entry) => entry.feature_key === "forge_match");

    expect(forgeMatch).toMatchObject({
      status: "granted",
      access_level: "admin",
      assigned_role_key: "workspace_admin",
    });
  });

  it("does not grant MCP access through workspace_admin alone", () => {
    const assignments: WorkspaceRoleAssignment[] = [
      {
        assignment_id: "1",
        user_id: "u1",
        workspace_id: "ws1",
        role_id: "r1",
        role_key: "workspace_admin",
        role_name: "workspace_admin",
        display_name: "Workspace Admin",
        category: "workspace",
        feature_key: null,
        access_level: "admin",
        source: "direct",
        created_at: null,
        updated_at: null,
      },
    ];

    const features: WorkspaceFeatureEntitlement[] = [
      {
        workspace_id: "ws1",
        feature_key: "queryforge_mcp",
        enabled: true,
        updated_at: null,
        updated_by: null,
        note: null,
      },
    ];

    const summary = buildEffectiveAccessSummary(assignments, features);
    const mcp = summary.find((entry) => entry.feature_key === "queryforge_mcp");

    expect(mcp).toMatchObject({
      status: "no_role",
      access_level: "none",
      assigned_role_key: null,
    });
  });
});
