import { afterEach, describe, expect, it } from "vitest";
import { Buffer } from "buffer";

import reducer, { setUser } from "./userSlice";
import { clearAccessToken, setAccessToken } from "../../../shared/runtime/accessTokenStore";

const createToken = (payload: Record<string, unknown>) => {
  const encode = (value: Record<string, unknown>) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.`;
};

describe("userSlice RBAC normalization", () => {
  afterEach(() => {
    clearAccessToken();
  });

  it("normalizes canonical feature roles from the profile payload", () => {
    const next = reducer(
      undefined,
      setUser({
        rbac_role_names: ["query_studio:admin", "catalog:user"],
      })
    );

    expect(next.rolesByFeature.query_studio).toEqual(["admin", "user"]);
    expect(next.rolesByFeature.catalog).toEqual(["user"]);
    expect(next.capabilities).toContain("query_studio:admin");
    expect(next.capabilities).toContain("query_studio:user");
    expect(next.capabilities).toContain("catalog:user");
  });

  it("expands super_admin from token claims into all canonical features", () => {
    setAccessToken(createToken({ sub: "u-1", roles: ["super_admin"] }));

    const next = reducer(undefined, setUser({}));

    expect(next.rolesByFeature.query_studio).toEqual(["admin", "user"]);
    expect(next.rolesByFeature.forge_match).toEqual(["admin", "user"]);
    expect(next.rolesByFeature.workspaces).toEqual(["admin", "user"]);
    expect(next.capabilities).toContain("system:admin");
    expect(next.capabilities).toContain("skills:user");
  });
});
