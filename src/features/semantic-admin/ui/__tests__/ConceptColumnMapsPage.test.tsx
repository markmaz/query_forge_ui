import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { server } from "../../../../test/msw/server";
import ConceptColumnMapsPage from "../ConceptColumnMapsPage";
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

type MappingRow = {
  id: number;
  vertical_norm: string;
  semantic_concept_id: number;
  concept_key: string;
  concept_name: string;
  model_column_id: number;
  column_name: string;
  model_table_name: string | null;
  relationship_kind: "primary" | "alternate";
  weight: number;
  created_at: string;
};

const baseRows: MappingRow[] = [
  {
    id: 1,
    vertical_norm: "education",
    semantic_concept_id: 101,
    concept_key: "DISTRICT_NAME",
    concept_name: "District Name",
    model_column_id: 1001,
    column_name: "district_name",
    model_table_name: "districts",
    relationship_kind: "primary",
    weight: 1,
    created_at: "2026-02-17T10:00:00",
  },
  {
    id: 2,
    vertical_norm: "education",
    semantic_concept_id: 102,
    concept_key: "SCHOOL_YEAR",
    concept_name: "School Year",
    model_column_id: 1002,
    column_name: "school_year",
    model_table_name: "schools",
    relationship_kind: "primary",
    weight: 0.9,
    created_at: "2026-02-17T10:00:00",
  },
  {
    id: 3,
    vertical_norm: "education",
    semantic_concept_id: 103,
    concept_key: "DISTRICT_CODE",
    concept_name: "District Code",
    model_column_id: 1003,
    column_name: "district_code",
    model_table_name: "districts",
    relationship_kind: "alternate",
    weight: 0.8,
    created_at: "2026-02-17T10:00:00",
  },
];

describe("ConceptColumnMapsPage", () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it("sends debounced q, concept_key, and column_name params", async () => {
    const seenParams: Array<Record<string, string>> = [];

    server.use(
      http.get("*/semantic/concept-column-maps", ({ request }) => {
        const url = new URL(request.url);
        const params = {
          q: url.searchParams.get("q") ?? "",
          concept_key: url.searchParams.get("concept_key") ?? "",
          column_name: url.searchParams.get("column_name") ?? "",
          page: url.searchParams.get("page") ?? "",
          page_size: url.searchParams.get("page_size") ?? "",
        };
        seenParams.push(params);

        const filtered = baseRows.filter((row) => {
          const q = params.q.toLowerCase();
          const concept = params.concept_key.toLowerCase();
          const column = params.column_name.toLowerCase();
          const qMatch =
            !q ||
            row.concept_key.toLowerCase().includes(q) ||
            row.concept_name.toLowerCase().includes(q) ||
            row.column_name.toLowerCase().includes(q) ||
            (row.model_table_name ?? "").toLowerCase().includes(q);
          const conceptMatch = !concept || row.concept_key.toLowerCase().includes(concept);
          const columnMatch = !column || row.column_name.toLowerCase().includes(column);
          return qMatch && conceptMatch && columnMatch;
        });

        return HttpResponse.json({
          rows: filtered,
          total: filtered.length,
          page: Number(params.page || 1),
          page_size: Number(params.page_size || 25),
        });
      })
    );

    const user = userEvent.setup();
    renderSemanticPage(<ConceptColumnMapsPage />, {
      route: "/semantic/concept-column-maps",
      preloadedState: adminState as any,
    });

    expect(await screen.findByRole("heading", { name: /concept-column maps/i })).toBeInTheDocument();
    expect(await screen.findByRole("columnheader", { name: /concept key/i })).toBeInTheDocument();
    expect(await screen.findByRole("columnheader", { name: /concept name/i })).toBeInTheDocument();
    expect(await screen.findByRole("columnheader", { name: /column name/i })).toBeInTheDocument();
    expect(await screen.findByRole("columnheader", { name: /model table/i })).toBeInTheDocument();
    expect(await screen.findByRole("columnheader", { name: /relationship/i })).toBeInTheDocument();
    expect(await screen.findByRole("columnheader", { name: /weight/i })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/search concept, concept name, column, table/i), "district");
    await waitFor(() => {
      const last = seenParams[seenParams.length - 1];
      expect(last.q).toBe("district");
      expect(last.concept_key).toBe("");
      expect(last.column_name).toBe("");
    });

    await user.clear(screen.getByPlaceholderText(/search concept, concept name, column, table/i));
    await user.type(screen.getByPlaceholderText(/concept key/i), "DISTRICT_NAME");
    await waitFor(() => {
      const last = seenParams[seenParams.length - 1];
      expect(last.q).toBe("");
      expect(last.concept_key).toBe("DISTRICT_NAME");
      expect(last.column_name).toBe("");
    });

    await user.clear(screen.getByPlaceholderText(/concept key/i));
    await user.type(screen.getByPlaceholderText(/column name/i), "district_code");
    await waitFor(() => {
      const last = seenParams[seenParams.length - 1];
      expect(last.q).toBe("");
      expect(last.concept_key).toBe("");
      expect(last.column_name).toBe("district_code");
    });
  });

  it("keeps server pagination with active search filters", async () => {
    const rows: MappingRow[] = Array.from({ length: 30 }, (_, index) => {
      const district = index < 15;
      return {
        id: index + 1,
        vertical_norm: "education",
        semantic_concept_id: 100 + index,
        concept_key: district ? `DISTRICT_METRIC_${index}` : `SCHOOL_METRIC_${index}`,
        concept_name: district ? `District Metric ${index}` : `School Metric ${index}`,
        model_column_id: 2000 + index,
        column_name: district ? `district_metric_${index}` : `school_metric_${index}`,
        model_table_name: district ? "districts" : "schools",
        relationship_kind: "primary",
        weight: 1,
        created_at: "2026-02-17T10:00:00",
      };
    });
    let lastPage = 1;
    let lastPageSize = 25;
    let lastQ = "";

    server.use(
      http.get("*/semantic/concept-column-maps", ({ request }) => {
        const url = new URL(request.url);
        const q = (url.searchParams.get("q") ?? "").toLowerCase();
        const page = Number(url.searchParams.get("page") || 1);
        const pageSize = Number(url.searchParams.get("page_size") || 25);
        lastPage = page;
        lastPageSize = pageSize;
        lastQ = q;

        const filtered = rows.filter((row) => {
          if (!q) return true;
          return (
            row.concept_key.toLowerCase().includes(q) ||
            row.concept_name.toLowerCase().includes(q) ||
            row.column_name.toLowerCase().includes(q) ||
            (row.model_table_name ?? "").toLowerCase().includes(q)
          );
        });

        const start = (page - 1) * pageSize;
        const paged = filtered.slice(start, start + pageSize);
        return HttpResponse.json({
          rows: paged,
          total: filtered.length,
          page,
          page_size: pageSize,
        });
      })
    );

    const user = userEvent.setup();
    renderSemanticPage(<ConceptColumnMapsPage />, {
      route: "/semantic/concept-column-maps",
      preloadedState: adminState as any,
    });

    await screen.findByRole("heading", { name: /concept-column maps/i });
    await user.type(screen.getByPlaceholderText(/search concept, concept name, column, table/i), "district");
    await waitFor(() => {
      expect(lastQ).toBe("district");
    });

    await user.selectOptions(screen.getByLabelText(/rows/i), "10");
    await waitFor(() => {
      expect(lastPageSize).toBe(10);
      expect(screen.getByText(/page 1 \/ 2/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => {
      expect(lastPage).toBe(2);
      expect(lastQ).toBe("district");
      expect(screen.getByText(/page 2 \/ 2/i)).toBeInTheDocument();
    });
  });

  it("uses name-based concept/model-column selectors in create and edit drawers while submitting ids", async () => {
    let createPayload: Record<string, unknown> | null = null;
    let updatePayload: Record<string, unknown> | null = null;
    const rows: MappingRow[] = [
      {
        id: 44,
        vertical_norm: "education",
        semantic_concept_id: 101,
        concept_key: "DISTRICT_NAME",
        concept_name: "District Name",
        model_column_id: 1001,
        column_name: "district_name",
        model_table_name: "districts",
        relationship_kind: "primary",
        weight: 1,
        created_at: "2026-02-17T10:00:00",
      },
    ];

    server.use(
      http.get("*/semantic/concept-column-maps", ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          rows,
          total: rows.length,
          page: Number(url.searchParams.get("page") || 1),
          page_size: Number(url.searchParams.get("page_size") || 25),
        });
      }),
      http.get("*/semantic/concepts", () =>
        HttpResponse.json({
          rows: [
            {
              id: 101,
              vertical_norm: "education",
              concept_key: "DISTRICT_NAME",
              name: "District Name",
              semantic_type: "dimension",
              filter_allowed: true,
              group_by_allowed: true,
              aggregation_allowed: false,
              is_identifier: false,
              is_metric: false,
              sensitive: false,
              status: "active",
            },
            {
              id: 102,
              vertical_norm: "education",
              concept_key: "SCHOOL_YEAR",
              name: "School Year",
              semantic_type: "dimension",
              filter_allowed: true,
              group_by_allowed: true,
              aggregation_allowed: false,
              is_identifier: false,
              is_metric: false,
              sensitive: false,
              status: "active",
            },
          ],
          page: 1,
          page_size: 100,
          total: 2,
        })
      ),
      http.get("*/models/columns", () =>
        HttpResponse.json({
          rows: [
            {
              id: 1001,
              model_table_id: 1,
              table_name: "districts",
              column_name: "district_name",
              data_type: "text",
              description: null,
              is_active: true,
            },
            {
              id: 1002,
              model_table_id: 2,
              table_name: "schools",
              column_name: "school_year",
              data_type: "text",
              description: null,
              is_active: true,
            },
          ],
        })
      ),
      http.post("*/semantic/concept-column-maps", async ({ request }) => {
        createPayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            id: 45,
            vertical_norm: createPayload.vertical_norm,
            semantic_concept_id: createPayload.semantic_concept_id,
            concept_key: "SCHOOL_YEAR",
            concept_name: "School Year",
            model_column_id: createPayload.model_column_id,
            column_name: "school_year",
            model_table_name: "schools",
            relationship_kind: createPayload.relationship_kind,
            weight: createPayload.weight,
            created_at: "2026-02-17T10:00:00",
          },
          { status: 201 }
        );
      }),
      http.patch("*/semantic/concept-column-maps/:mapId", async ({ request }) => {
        updatePayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          id: 44,
          vertical_norm: updatePayload.vertical_norm,
          semantic_concept_id: updatePayload.semantic_concept_id,
          concept_key: "SCHOOL_YEAR",
          concept_name: "School Year",
          model_column_id: updatePayload.model_column_id,
          column_name: "school_year",
          model_table_name: "schools",
          relationship_kind: updatePayload.relationship_kind,
          weight: updatePayload.weight,
          created_at: "2026-02-17T10:00:00",
        });
      })
    );

    const user = userEvent.setup();
    renderSemanticPage(<ConceptColumnMapsPage />, {
      route: "/semantic/concept-column-maps",
      preloadedState: adminState as any,
    });

    await screen.findByRole("heading", { name: /concept-column maps/i });

    await user.click(screen.getByRole("button", { name: /create map/i }));
    const createDrawer = await screen.findByRole("dialog", { name: /create concept-column map/i });

    await user.type(within(createDrawer).getByLabelText(/^vertical$/i), "education");
    await user.click(within(createDrawer).getByRole("button", { name: /^semantic concept$/i }));
    await user.type(screen.getByLabelText(/search semantic concept/i), "school");
    await user.click(screen.getByRole("button", { name: /school year \(school_year\)/i }));
    expect(within(createDrawer).getByRole("button", { name: /^semantic concept$/i })).toHaveTextContent(
      "School Year (SCHOOL_YEAR)"
    );

    await user.click(within(createDrawer).getByRole("button", { name: /^model column$/i }));
    await user.type(screen.getByLabelText(/search model column/i), "school_year");
    await user.click(screen.getByRole("button", { name: /schools\.school_year/i }));
    expect(within(createDrawer).getByRole("button", { name: /^model column$/i })).toHaveTextContent(
      "schools.school_year"
    );

    await user.click(within(createDrawer).getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(createPayload).toMatchObject({
        vertical_norm: "education",
        semantic_concept_id: 102,
        model_column_id: 1002,
      });
    });

    await user.click(screen.getByRole("button", { name: /district_name/i }));
    const editDrawer = await screen.findByRole("dialog", { name: /edit concept-column map/i });
    expect(within(editDrawer).getByRole("button", { name: /^semantic concept$/i })).toHaveTextContent(
      "District Name (DISTRICT_NAME)"
    );
    expect(within(editDrawer).getByRole("button", { name: /^model column$/i })).toHaveTextContent(
      "districts.district_name"
    );

    await user.click(within(editDrawer).getByRole("button", { name: /^semantic concept$/i }));
    await user.click(screen.getByRole("button", { name: /school year \(school_year\)/i }));
    await user.click(within(editDrawer).getByRole("button", { name: /^model column$/i }));
    await user.click(screen.getByRole("button", { name: /schools\.school_year/i }));
    await user.click(within(editDrawer).getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(updatePayload).toMatchObject({
        semantic_concept_id: 102,
        model_column_id: 1002,
      });
    });
  });
});
