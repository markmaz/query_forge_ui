import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSemanticCatalog,
  normalizeSemanticCatalogBuildResponse,
  parseSemanticCatalogBuildError,
  SemanticCatalogBuildApiError,
  toSemanticCatalogBuildPayload,
} from "./semanticCatalog";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  getApiWorkspaceId: vi.fn(),
  getAccessToken: vi.fn(),
}));

vi.mock("@/shared/services/api", () => ({
  default: {
    post: mocks.post,
  },
  getApiWorkspaceId: mocks.getApiWorkspaceId,
}));

vi.mock("@/shared/runtime/accessTokenStore", () => ({
  getAccessToken: mocks.getAccessToken,
}));

describe("semantic catalog api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApiWorkspaceId.mockReturnValue("ws-123");
    mocks.getAccessToken.mockReturnValue("token-abc");
  });

  it("maps build request payload and sends admin headers", async () => {
    mocks.post.mockResolvedValue({
      data: {
        result: {
          workspace_id: "ws-123",
          domain_id: 7,
          profile_count: 1,
          enriched_count: 1,
          concepts_upserted: 2,
          aliases_upserted: 3,
          relationships_upserted: 4,
          value_aliases_upserted: 5,
          derived_metrics_created: 1,
          index_items_count: 2,
          dry_run: true,
          concept_preview: [{ concept_key: "REVENUE" }],
          alias_preview: [],
          relationship_preview: [],
          index_preview: [],
        },
      },
    });

    const response = await buildSemanticCatalog({
      workspace_id: "should-not-be-sent",
      domain_id: 7,
      domain_name: "Sales",
      dry_run: true,
      table_limit: 5000,
    });

    expect(mocks.post).toHaveBeenCalledWith(
      "/admin/semantic-catalog/build",
      {
        domain_id: 7,
        domain_name: "Sales",
        dry_run: true,
        table_limit: 5000,
      },
      {
        headers: {
          Authorization: "Bearer token-abc",
          "X-Workspace-Id": "ws-123",
        },
      },
    );
    expect(response.result.domain_id).toBe(7);
    expect(response.result.concept_preview).toHaveLength(1);
  });

  it("normalizes semantic catalog build response shape", () => {
    const response = normalizeSemanticCatalogBuildResponse({
      result: {
        workspace_id: "ws-9",
        domain_id: "3",
        domain_name: "Sales Performance",
        profile_count: "123",
        enriched_count: 123,
        concepts_upserted: 40,
        aliases_upserted: 55,
        relationships_upserted: 70,
        value_aliases_upserted: 10,
        derived_metrics_created: 3,
        index_items_count: 40,
        dry_run: false,
        concept_preview: ["raw"],
        alias_preview: [{ alias: "sales" }],
        relationship_preview: [],
        index_preview: [],
      },
    });

    expect(response.result.workspace_id).toBe("ws-9");
    expect(response.result.domain_id).toBe(3);
    expect(response.result.profile_count).toBe(123);
    expect(response.result.concept_preview[0]).toEqual({ value: "raw" });
    expect(response.result.alias_preview[0]).toEqual({ alias: "sales" });
  });

  it("surfaces validation errors from 400 responses", () => {
    const error = parseSemanticCatalogBuildError({
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          error: "Invalid request",
          details: {
            errors: {
              domain_id: ["required"],
              table_limit: ["must be <= 50000"],
            },
          },
        },
      },
    });

    expect(error).toBeInstanceOf(SemanticCatalogBuildApiError);
    expect(error.message).toBe("Invalid request");
    expect(error.fieldErrors.domain_id).toEqual(["required"]);
    expect(error.fieldErrors.table_limit).toEqual(["must be <= 50000"]);
  });

  it("forces domain and table limit validation in payload mapper", () => {
    expect(() =>
      toSemanticCatalogBuildPayload({
        domain_id: 0,
        table_limit: 100000,
        dry_run: true,
      }),
    ).toThrowError(/invalid build request/i);
  });
});
