import { describe, expect, it, beforeEach } from "vitest";

import type { DomainGraphApiPayload } from "./graphTypes";
import {
  applyDomainGraphLayout,
  getDomainGraphLayoutStorageKey,
  loadDomainGraphLayout,
  persistDomainGraphLayout,
} from "./layoutPersistence";

const payloadFixture: DomainGraphApiPayload = {
  domain_tables: [
    {
      graph_node_id: "domain_table_10",
      workspace_table_id: 10,
      table_name: "students",
      schema_name: "core",
      table_alias: "students",
      filter_mode: "AUTO",
      cardinality: "ONE",
      is_root: true,
      x: 100,
      y: 120,
    },
    {
      graph_node_id: "domain_table_20",
      workspace_table_id: 20,
      table_name: "schools",
      schema_name: "core",
      table_alias: "schools",
      filter_mode: "AUTO",
      cardinality: "ONE",
      is_root: false,
      x: 340,
      y: 120,
    },
  ],
  joins: [],
};

describe("domain graph layout persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("builds a domain/workspace-scoped storage key", () => {
    expect(getDomainGraphLayoutStorageKey(12, "ws-1")).toBe(
      "qf.domain-graph-layout.v1:ws-1:12"
    );
    expect(getDomainGraphLayoutStorageKey(0, "ws-1")).toBeNull();
    expect(getDomainGraphLayoutStorageKey(12, "   ")).toBeNull();
  });

  it("persists and loads node positions", () => {
    persistDomainGraphLayout(12, "ws-1", payloadFixture);

    const loaded = loadDomainGraphLayout(12, "ws-1");
    expect(loaded).toEqual({
      domain_table_10: { x: 100, y: 120 },
      domain_table_20: { x: 340, y: 120 },
    });
  });

  it("applies saved coordinates only to matching graph nodes", () => {
    const applied = applyDomainGraphLayout(payloadFixture, {
      domain_table_10: { x: 800, y: 900 },
      unknown_node: { x: 1, y: 2 },
    });

    expect(applied.domain_tables[0].x).toBe(800);
    expect(applied.domain_tables[0].y).toBe(900);
    expect(applied.domain_tables[1].x).toBe(340);
    expect(applied.domain_tables[1].y).toBe(120);
  });

  it("ignores invalid localStorage payloads", () => {
    const key = getDomainGraphLayoutStorageKey(12, "ws-1");
    expect(key).toBeTruthy();
    window.localStorage.setItem(String(key), "{ not-valid-json");
    expect(loadDomainGraphLayout(12, "ws-1")).toEqual({});

    window.localStorage.setItem(
      String(key),
      JSON.stringify({ version: 999, nodes: [] })
    );
    expect(loadDomainGraphLayout(12, "ws-1")).toEqual({});
  });
});

