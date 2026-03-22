import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { server } from "../../../../qa/msw/server";
import RelationshipsPage from "../RelationshipsPage";
import { renderSemanticPage } from "./renderSemanticPage";

const adminState = {
  auth: {
    isAuthenticated: true,
    bootstrapped: true,
  },
  user: {
    user: { user_id: "admin-1" },
    rolesByFeature: {
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

const conceptOptions = [
  { concept_id: 11, concept_key: "DISTRICT_NAME", display_label: "District Name", name: "District Name" },
  { concept_id: 22, concept_key: "SCHOOL_NAME", display_label: "School Name", name: "School Name" },
  { concept_id: 33, concept_key: "REGION_NAME", display_label: "Region Name", name: "Region Name" },
];

describe("RelationshipsPage", () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it("renders human-readable relationship labels", async () => {
    server.use(
      http.get("*/semantic/relationships", () =>
        HttpResponse.json({
          rows: [
            {
              id: 101,
              relationship_type: "depends_on",
              parent_concept_id: 11,
              child_concept_id: 22,
              parent_display_label: "District Name",
              child_display_label: "School Name",
              vertical_norm: "education",
              created_at: "2026-03-11T11:20:00Z",
            },
          ],
          page: 1,
          page_size: 25,
          total: 1,
        })
      )
    );

    renderSemanticPage(<RelationshipsPage />, { route: "/admin/semantic/relationships", preloadedState: adminState as any });

    expect(await screen.findByRole("heading", { name: /semantic relationships/i })).toBeInTheDocument();
    expect(await screen.findByText("District Name")).toBeInTheDocument();
    expect(screen.getByText("School Name")).toBeInTheDocument();
    expect(screen.getByText("#101")).toBeInTheDocument();
  });

  it("sends server search and id compatibility filters", async () => {
    let lastQuery = "";
    let parentId = "";
    let childId = "";
    let parentConceptId = "";
    let childConceptId = "";

    server.use(
      http.get("*/semantic/relationships", ({ request }) => {
        const url = new URL(request.url);
        lastQuery = url.searchParams.get("q") ?? "";
        parentId = url.searchParams.get("parent_id") ?? "";
        childId = url.searchParams.get("child_id") ?? "";
        parentConceptId = url.searchParams.get("parent_concept_id") ?? "";
        childConceptId = url.searchParams.get("child_concept_id") ?? "";
        return HttpResponse.json({
          rows: [],
          page: 1,
          page_size: 25,
          total: 0,
        });
      })
    );

    const user = userEvent.setup();
    renderSemanticPage(<RelationshipsPage />, { route: "/admin/semantic/relationships", preloadedState: adminState as any });
    await screen.findByRole("heading", { name: /semantic relationships/i });

    await user.type(screen.getByPlaceholderText(/search type or concept labels/i), "district");
    await user.type(screen.getByPlaceholderText(/parent id/i), "11");
    await user.type(screen.getByPlaceholderText(/child id/i), "22");

    await waitFor(() => {
      expect(lastQuery).toBe("district");
      expect(parentId).toBe("11");
      expect(childId).toBe("22");
      expect(parentConceptId).toBe("11");
      expect(childConceptId).toBe("22");
    });
  });

  it("creates relationship via concept lookup selectors", async () => {
    let createPayload: Record<string, unknown> | null = null;
    let rows: Array<Record<string, unknown>> = [];

    server.use(
      http.get("*/semantic/relationships", () =>
        HttpResponse.json({
          rows,
          page: 1,
          page_size: 25,
          total: rows.length,
        })
      ),
      http.get("*/semantic/relationships/concepts", ({ request }) => {
        const url = new URL(request.url);
        const query = (url.searchParams.get("q") ?? "").toLowerCase();
        const filtered = conceptOptions.filter((option) =>
          `${option.display_label} ${option.concept_key}`.toLowerCase().includes(query)
        );
        return HttpResponse.json({
          rows: filtered,
          page: 1,
          page_size: 25,
          total: filtered.length,
        });
      }),
      http.post("*/semantic/relationships", async ({ request }) => {
        createPayload = (await request.json()) as Record<string, unknown>;
        rows = [
          {
            id: 202,
            relationship_type: createPayload.relationship_type,
            parent_concept_id: createPayload.parent_concept_id,
            child_concept_id: createPayload.child_concept_id,
            parent_display_label: "District Name",
            child_display_label: "School Name",
            vertical_norm: "education",
            created_at: "2026-03-11T12:00:00Z",
          },
        ];
        return HttpResponse.json({ result: rows[0] }, { status: 201 });
      })
    );

    const user = userEvent.setup();
    renderSemanticPage(<RelationshipsPage />, { route: "/admin/semantic/relationships", preloadedState: adminState as any });

    await screen.findByRole("heading", { name: /semantic relationships/i });
    await user.click(screen.getByRole("button", { name: /create relationship/i }));

    const drawer = await screen.findByRole("dialog", { name: /create relationship/i });
    await user.type(within(drawer).getByLabelText(/relationship type/i), "depends_on");

    const parentInput = within(drawer).getByLabelText(/parent concept/i);
    await user.click(parentInput);
    await user.type(parentInput, "district");
    await user.click(await screen.findByRole("button", { name: /district name/i }));

    const childInput = within(drawer).getByLabelText(/child concept/i);
    await user.click(childInput);
    await user.type(childInput, "school");
    await user.click(await screen.findByRole("button", { name: /school name/i }));

    await user.click(within(drawer).getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(createPayload).toMatchObject({
        relationship_type: "depends_on",
        parent_concept_id: 11,
        child_concept_id: 22,
      });
    });
  });

  it("edits relationship via lookup selector and sends patch", async () => {
    let patchPayload: Record<string, unknown> | null = null;

    server.use(
      http.get("*/semantic/relationships", () =>
        HttpResponse.json({
          rows: [
            {
              id: 303,
              relationship_type: "depends_on",
              parent_concept_id: 11,
              child_concept_id: 22,
              parent_display_label: "District Name",
              child_display_label: "School Name",
              vertical_norm: "education",
              created_at: "2026-03-11T12:00:00Z",
            },
          ],
          page: 1,
          page_size: 25,
          total: 1,
        })
      ),
      http.get("*/semantic/relationships/303", () =>
        HttpResponse.json({
          result: {
            id: 303,
            relationship_type: "depends_on",
            parent_concept_id: 11,
            child_concept_id: 22,
            parent_display_label: "District Name",
            child_display_label: "School Name",
            vertical_norm: "education",
          },
        })
      ),
      http.get("*/semantic/relationships/concepts", ({ request }) => {
        const url = new URL(request.url);
        const query = (url.searchParams.get("q") ?? "").toLowerCase();
        const filtered = conceptOptions.filter((option) =>
          `${option.display_label} ${option.concept_key}`.toLowerCase().includes(query)
        );
        return HttpResponse.json({
          rows: filtered,
          page: 1,
          page_size: 25,
          total: filtered.length,
        });
      }),
      http.patch("*/semantic/relationships/303", async ({ request }) => {
        patchPayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          result: {
            id: 303,
            relationship_type: "depends_on",
            parent_concept_id: 11,
            child_concept_id: 33,
            parent_display_label: "District Name",
            child_display_label: "Region Name",
            vertical_norm: "education",
          },
        });
      })
    );

    const user = userEvent.setup();
    renderSemanticPage(<RelationshipsPage />, { route: "/admin/semantic/relationships", preloadedState: adminState as any });

    await screen.findByRole("heading", { name: /semantic relationships/i });
    await user.click(await screen.findByRole("button", { name: /^depends_on$/i }));

    const drawer = await screen.findByRole("dialog", { name: /edit relationship/i });
    const childInput = within(drawer).getByLabelText(/child concept/i);
    await user.clear(childInput);
    await user.type(childInput, "region");
    await user.click(await screen.findByRole("button", { name: /region name/i }));

    await user.click(within(drawer).getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(patchPayload).toMatchObject({
        child_concept_id: 33,
      });
    });
  });

  it("deletes relationship after confirmation", async () => {
    let deletedId: string | null = null;
    let currentRows = [
      {
        id: 404,
        relationship_type: "depends_on",
        parent_concept_id: 11,
        child_concept_id: 22,
        parent_display_label: "District Name",
        child_display_label: "School Name",
        vertical_norm: "education",
        created_at: "2026-03-11T12:00:00Z",
      },
    ];

    server.use(
      http.get("*/semantic/relationships", () =>
        HttpResponse.json({
          rows: currentRows,
          page: 1,
          page_size: 25,
          total: currentRows.length,
        })
      ),
      http.delete("*/semantic/relationships/:id", ({ params }) => {
        deletedId = String(params.id);
        currentRows = [];
        return HttpResponse.json({ ok: true });
      })
    );

    const user = userEvent.setup();
    renderSemanticPage(<RelationshipsPage />, { route: "/admin/semantic/relationships", preloadedState: adminState as any });

    await screen.findByText("District Name");
    await user.click(screen.getByRole("button", { name: /delete relationship 404/i }));
    await user.click(await screen.findByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(deletedId).toBe("404");
    });
  });

  it("shows inline backend validation errors on create failure", async () => {
    server.use(
      http.get("*/semantic/relationships", () =>
        HttpResponse.json({
          rows: [],
          page: 1,
          page_size: 25,
          total: 0,
        })
      ),
      http.get("*/semantic/relationships/concepts", () =>
        HttpResponse.json({
          rows: conceptOptions,
          page: 1,
          page_size: 25,
          total: conceptOptions.length,
        })
      ),
      http.post("*/semantic/relationships", () =>
        HttpResponse.json(
          {
            error: "Invalid request",
            details: {
              errors: [{ field: "relationship_type", message: "Duplicate relationship cycle detected." }],
            },
          },
          { status: 409 }
        )
      )
    );

    const user = userEvent.setup();
    renderSemanticPage(<RelationshipsPage />, { route: "/admin/semantic/relationships", preloadedState: adminState as any });

    await screen.findByRole("heading", { name: /semantic relationships/i });
    await user.click(screen.getByRole("button", { name: /create relationship/i }));

    const drawer = await screen.findByRole("dialog", { name: /create relationship/i });
    await user.type(within(drawer).getByLabelText(/relationship type/i), "depends_on");

    const parentInput = within(drawer).getByLabelText(/parent concept/i);
    await user.click(parentInput);
    await user.click(await screen.findByRole("button", { name: /district name/i }));

    const childInput = within(drawer).getByLabelText(/child concept/i);
    await user.click(childInput);
    await user.click(await screen.findByRole("button", { name: /school name/i }));

    await user.click(within(drawer).getByRole("button", { name: /^save$/i }));

    expect(await within(drawer).findByText(/duplicate relationship cycle detected/i)).toBeInTheDocument();
  });
});
