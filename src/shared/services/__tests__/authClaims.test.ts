import { Buffer } from "buffer";
import { describe, expect, it } from "vitest";
import { getRolesFromToken, isAdmin } from ".././auth";

const createToken = (payload: Record<string, unknown>) => {
  const encode = (value: Record<string, unknown>) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.`;
};

describe("auth claim helpers", () => {
  it("extracts roles from token", () => {
    const token = createToken({ roles: ["viewer", "admin"] });
    expect(getRolesFromToken(token)).toEqual(["viewer", "admin"]);
  });

  it("returns admin based on is_admin claim", () => {
    const token = createToken({ roles: ["viewer"], is_admin: true });
    expect(isAdmin(token)).toBe(true);
  });

  it("returns admin based on roles claim", () => {
    const token = createToken({ roles: ["admin"], is_admin: false });
    expect(isAdmin(token)).toBe(true);
  });

  it("treats canonical RBAC admin roles as admin", () => {
    const superAdminToken = createToken({ roles: ["super_admin"], is_admin: false });
    const workspaceAdminToken = createToken({ roles: ["workspace_admin"], is_admin: false });
    expect(isAdmin(superAdminToken)).toBe(true);
    expect(isAdmin(workspaceAdminToken)).toBe(true);
  });

  it("handles invalid token safely", () => {
    expect(getRolesFromToken("bad-token")).toEqual([]);
    expect(isAdmin("bad-token")).toBe(false);
  });
});
