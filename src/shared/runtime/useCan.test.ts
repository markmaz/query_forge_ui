import { describe, expect, it } from "vitest";

import { roleSatisfies } from "./useCan";

describe("roleSatisfies", () => {
  it("allows feature admins to satisfy user and viewer checks", () => {
    expect(roleSatisfies("admin", "user")).toBe(true);
    expect(roleSatisfies("admin", "viewer")).toBe(true);
    expect(roleSatisfies("admin", "designer")).toBe(true);
    expect(roleSatisfies("admin", "operator")).toBe(true);
  });

  it("does not allow lower feature roles to satisfy admin checks", () => {
    expect(roleSatisfies("user", "admin")).toBe(false);
    expect(roleSatisfies("viewer", "user")).toBe(false);
    expect(roleSatisfies("designer", "operator")).toBe(false);
    expect(roleSatisfies("operator", "designer")).toBe(false);
  });

  it("allows FlowForge designer and operator roles to satisfy read checks", () => {
    expect(roleSatisfies("designer", "viewer")).toBe(true);
    expect(roleSatisfies("operator", "viewer")).toBe(true);
    expect(roleSatisfies("user", "viewer")).toBe(true);
  });

  it("falls back to exact matching for non-hierarchical roles", () => {
    expect(roleSatisfies("workspace_admin", "workspace_admin")).toBe(true);
    expect(roleSatisfies("workspace_admin", "user")).toBe(false);
  });
});
