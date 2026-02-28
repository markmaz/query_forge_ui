import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import * as noCodeAdminApi from ".././noCodeAdminApi";
import * as valueOverrideApi from ".././valueOverride";

describe("value_override naming migration", () => {
  it("exports value override API surface without legacy crosswalk symbols", () => {
    const names = Object.keys(valueOverrideApi);
    expect(names).toContain("fetchValueOverrideIndex");
    expect(names).toContain("fetchValueOverridePreview");
    expect(names).toContain("patchValueOverrideVisibility");
    expect(names).toContain("deleteValueOverride");
    expect(names.some((name) => name.includes("Crosswalk"))).toBe(false);
    expect(names.some((name) => name.includes("crosswalk"))).toBe(false);
  });

  it("uses value override visibility API naming", () => {
    const names = Object.keys(noCodeAdminApi);
    expect(names).toContain("getVisibleValueOverrides");
    expect(names).not.toContain("getVisibleCrosswalks");
  });

  it("targets /value_overrides endpoints in source files", () => {
    const root = process.cwd();
    const valueOverrideSource = readFileSync(path.join(root, "src/shared/services/valueOverride.ts"), "utf8");
    const noCodeAdminSource = readFileSync(path.join(root, "src/shared/services/noCodeAdminApi.ts"), "utf8");
    const mswSource = readFileSync(path.join(root, "src/test/msw/handlers.ts"), "utf8");

    const requestCallPattern = /api\.(?:get|post|put|patch|delete)\(\s*([`'"])([^`'"]+)\1/g;

    for (const source of [valueOverrideSource, noCodeAdminSource]) {
      let sawValueOverrideEndpoint = false;
      for (const match of source.matchAll(requestCallPattern)) {
        const endpoint = match[2];
        expect(endpoint.startsWith("/crosswalks")).toBe(false);
        if (endpoint.startsWith("/value_overrides")) sawValueOverrideEndpoint = true;
      }
      expect(sawValueOverrideEndpoint).toBe(true);
    }

    expect(mswSource.includes("/value_overrides/visibility")).toBe(true);
    expect(mswSource.includes("/crosswalks/visibility")).toBe(false);
  });
});
