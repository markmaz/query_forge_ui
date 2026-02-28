import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { server } from "../../../../test/msw/server";
import ConceptsPage from "../ConceptsPage";
import { renderSemanticPage } from "./renderSemanticPage";

const adminState = {
  auth: {
    isAuthenticated: true,
    bootstrapped: true,
  },
  user: {
    user: { user_id: "user-1" },
    rolesByProduct: {
      semantic: ["admin"],
    },
    capabilities: ["semantic:admin"],
    loading: false,
    initialized: true,
    error: null,
  },
  userWorkspaces: {
    selectedWorkspaceId: "ws-1",
  },
};

describe("ConceptsPage", () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it("renders list, sends filters, and creates a concept", async () => {
    let concepts = [
      {
        concept_id: 1,
        vertical_norm: "education",
        concept_key: "district_name",
        name: "District Name",
        description: null,
        semantic_type: "dimension",
        sub_type: null,
        entity: null,
        granularity_rank: null,
        filter_allowed: true,
        group_by_allowed: true,
        aggregation_allowed: false,
        is_identifier: false,
        is_metric: false,
        display_priority: null,
        sensitive: false,
        status: "active",
      },
    ];
    let lastSearch = "";
    let createPayload: Record<string, unknown> | null = null;

    server.use(
      http.get("*/semantic/concepts", ({ request }) => {
        const url = new URL(request.url);
        lastSearch = url.searchParams.get("q") ?? "";
        return HttpResponse.json({
          items: concepts,
          page: Number(url.searchParams.get("page") || 1),
          page_size: Number(url.searchParams.get("page_size") || 25),
          total: concepts.length,
        });
      }),
      http.post("*/semantic/concepts", async ({ request }) => {
        createPayload = (await request.json()) as Record<string, unknown>;
        concepts = [
          ...concepts,
          {
            concept_id: 2,
            vertical_norm: "education",
            concept_key: "enrollment_count",
            name: "Enrollment Count",
            description: null,
            semantic_type: "metric",
            sub_type: null,
            entity: null,
            granularity_rank: null,
            filter_allowed: false,
            group_by_allowed: false,
            aggregation_allowed: true,
            is_identifier: false,
            is_metric: true,
            display_priority: null,
            sensitive: false,
            status: "active",
          },
        ];
        return HttpResponse.json(concepts[concepts.length - 1]);
      })
    );

    const user = userEvent.setup();
    renderSemanticPage(<ConceptsPage />, { preloadedState: adminState as any });

    expect(await screen.findByRole("heading", { name: /semantic concepts/i })).toBeInTheDocument();
    expect(await screen.findByText("District Name")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/search concepts/i), "enroll");
    await waitFor(() => {
      expect(lastSearch).toContain("enroll");
    });

    await user.click(screen.getByRole("button", { name: /create concept/i }));
    await user.type(screen.getByLabelText(/^vertical$/i), "education");
    await user.type(screen.getByLabelText(/^concept key$/i), "enrollment_count");
    await user.type(screen.getByLabelText(/^name$/i), "Enrollment Count");
    await user.type(screen.getByLabelText(/^semantic type$/i), "metric");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(createPayload).toMatchObject({
        vertical_norm: "education",
        concept_key: "enrollment_count",
        name: "Enrollment Count",
        semantic_type: "metric",
      });
    });

    expect(await screen.findByText("Enrollment Count")).toBeInTheDocument();
  });

  it("rebuilds vector index with selected vertical and shows confirm flow", async () => {
    let rebuildPayload: Record<string, unknown> | null = null;

    server.use(
      http.get("*/semantic/concepts", () =>
        HttpResponse.json({
          items: [],
          page: 1,
          page_size: 25,
          total: 0,
        })
      ),
      http.post("*/semantic/concepts/rebuild-index", async ({ request }) => {
        rebuildPayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ message: "queued 120 concepts", vertical_norm: "education" });
      })
    );

    const user = userEvent.setup();
    renderSemanticPage(<ConceptsPage />, { preloadedState: adminState as any });

    await screen.findByRole("heading", { name: /semantic concepts/i });
    await user.type(screen.getByPlaceholderText(/^vertical$/i), "education");
    await user.click(screen.getByRole("button", { name: /rebuild vector index/i }));

    expect(await screen.findByText(/rebuild vector indexes for semantic concepts/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^vertical$/i)).toHaveValue("education");
    await user.click(screen.getByRole("button", { name: /^rebuild indexes$/i }));

    await waitFor(() => {
      expect(rebuildPayload).toMatchObject({ vertical_norm: "education" });
    });
  });

  it("defaults rebuild vertical to generic when modal input is blank", async () => {
    let rebuildPayload: Record<string, unknown> | null = null;

    server.use(
      http.get("*/semantic/concepts", () =>
        HttpResponse.json({
          items: [],
          page: 1,
          page_size: 25,
          total: 0,
        })
      ),
      http.post("*/semantic/concepts/rebuild-index", async ({ request }) => {
        rebuildPayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ message: "queued", vertical_norm: "generic" });
      })
    );

    const user = userEvent.setup();
    renderSemanticPage(<ConceptsPage />, { preloadedState: adminState as any });

    await screen.findByRole("heading", { name: /semantic concepts/i });
    await user.click(screen.getByRole("button", { name: /rebuild vector index/i }));
    await user.click(screen.getByRole("button", { name: /^rebuild indexes$/i }));

    await waitFor(() => {
      expect(rebuildPayload).toMatchObject({ vertical_norm: "generic" });
    });
  });

  it("shows admin required error when rebuild endpoint returns 403", async () => {
    server.use(
      http.get("*/semantic/concepts", () =>
        HttpResponse.json({
          items: [],
          page: 1,
          page_size: 25,
          total: 0,
        })
      ),
      http.post("*/semantic/concepts/rebuild-index", () =>
        HttpResponse.json({ error: "forbidden" }, { status: 403 })
      )
    );

    const user = userEvent.setup();
    renderSemanticPage(<ConceptsPage />, { preloadedState: adminState as any });

    await screen.findByRole("heading", { name: /semantic concepts/i });
    await user.click(screen.getByRole("button", { name: /rebuild vector index/i }));
    await user.click(screen.getByRole("button", { name: /^rebuild indexes$/i }));

    expect(await screen.findByText(/admin access required/i)).toBeInTheDocument();
  });

  it("runs full semantic plan index rebuild sequentially and shows details", async () => {
    const endpointOrder: string[] = [];
    let conceptPayload: Record<string, unknown> | null = null;
    let embeddingsPayload: Record<string, unknown> | null = null;
    let domainsPayload: Record<string, unknown> | null = null;

    server.use(
      http.get("*/semantic/concepts", () =>
        HttpResponse.json({
          items: [],
          page: 1,
          page_size: 25,
          total: 0,
        })
      ),
      http.post("*/semantic/concepts/rebuild-index", async ({ request }) => {
        endpointOrder.push("concept");
        conceptPayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ message: "concept queued" }, { status: 202 });
      }),
      http.post("*/embeddings/rebuild", async ({ request }) => {
        endpointOrder.push("embeddings");
        embeddingsPayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ message: "embeddings rebuilt" }, { status: 200 });
      }),
      http.post("*/embeddings/domains/upsert", async ({ request }) => {
        endpointOrder.push("domains");
        domainsPayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ message: "domains upserted" }, { status: 200 });
      })
    );

    const user = userEvent.setup();
    renderSemanticPage(<ConceptsPage />, { preloadedState: adminState as any });

    await screen.findByRole("heading", { name: /semantic concepts/i });
    await user.click(screen.getByRole("button", { name: /rebuild semantic plan indexes/i }));

    expect(await screen.findByRole("dialog", { name: /rebuild semantic plan indexes\?/i })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/vertical \(optional\)/i), "education");
    await user.click(screen.getByRole("button", { name: /rebuild plan indexes/i }));

    await waitFor(() => {
      expect(endpointOrder).toEqual(["concept", "embeddings", "domains"]);
    });
    expect(conceptPayload).toMatchObject({ vertical_norm: "education" });
    expect(embeddingsPayload).toMatchObject({ includeTables: true, workspaceId: "ws-1" });
    expect(domainsPayload).toMatchObject({ workspace_id: "ws-1", force: true });
    expect(await screen.findByText(/3\/3 steps succeeded/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /view details/i }));
    expect(screen.getByText(/\/api\/v1\/semantic\/concepts\/rebuild-index/i)).toBeInTheDocument();
    expect(screen.getByText(/\/api\/v1\/embeddings\/rebuild/i)).toBeInTheDocument();
    expect(screen.getByText(/\/api\/v1\/embeddings\/domains\/upsert/i)).toBeInTheDocument();
  });

  it("continues full rebuild when one step fails and reports partial failure", async () => {
    const endpointOrder: string[] = [];

    server.use(
      http.get("*/semantic/concepts", () =>
        HttpResponse.json({
          items: [],
          page: 1,
          page_size: 25,
          total: 0,
        })
      ),
      http.post("*/semantic/concepts/rebuild-index", () => {
        endpointOrder.push("concept");
        return HttpResponse.json({ error: "concept rebuild failed" }, { status: 500 });
      }),
      http.post("*/embeddings/rebuild", () => {
        endpointOrder.push("embeddings");
        return HttpResponse.json({ message: "embeddings rebuilt" }, { status: 200 });
      }),
      http.post("*/embeddings/domains/upsert", () => {
        endpointOrder.push("domains");
        return HttpResponse.json({ message: "domains upserted" }, { status: 200 });
      })
    );

    const user = userEvent.setup();
    renderSemanticPage(<ConceptsPage />, { preloadedState: adminState as any });

    await screen.findByRole("heading", { name: /semantic concepts/i });
    await user.click(screen.getByRole("button", { name: /rebuild semantic plan indexes/i }));
    await user.click(screen.getByRole("button", { name: /rebuild plan indexes/i }));

    await waitFor(() => {
      expect(endpointOrder).toEqual(["concept", "embeddings", "domains"]);
    });
    expect(await screen.findByText(/completed with partial failure/i)).toBeInTheDocument();
    expect(screen.getByText(/concept rebuild failed/i)).toBeInTheDocument();
  });
});
