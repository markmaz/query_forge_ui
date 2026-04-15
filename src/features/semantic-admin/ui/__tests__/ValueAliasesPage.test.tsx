import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { server } from "../../../../qa/msw/server";
import ValueAliasesPage from "../ValueAliasesPage";
import { renderSemanticPage } from "./renderSemanticPage";

const adminState = {
  auth: {
    isAuthenticated: true,
    bootstrapped: true,
  },
  user: {
    user: { user_id: "user-1" },
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

vi.setConfig({ testTimeout: 20_000 });

describe("ValueAliasesPage", () => {

  beforeEach(() => {
    server.use(
      http.get("*/semantic/concept-column-maps", () =>
        HttpResponse.json({
          items: [],
          page: 1,
          page_size: 5,
          total: 0,
        })
      )
    );
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it("uses concept-key dropdown in create drawer and submits mapped semantic_concept_id", async () => {
    let conceptMapsRequestCount = 0;
    let createPayload: Record<string, unknown> | null = null;

    server.use(
      http.get("*/semantic/value-aliases", () =>
        HttpResponse.json({
          items: [],
          page: 1,
          page_size: 25,
          total: 0,
        })
      ),
      http.get("*/semantic/concepts/keys", async ({ request }) => {
        await new Promise((resolve) => window.setTimeout(resolve, 50));
        expect(new URL(request.url).searchParams.get("vertical")).toBeNull();
        return HttpResponse.json({ concept_keys: ["GENERIC_DIMENSION", "SCHOOL_YEAR"] });
      }),
      http.get("*/semantic/concepts", async ({ request }) => {
        await new Promise((resolve) => window.setTimeout(resolve, 50));
        expect(new URL(request.url).searchParams.get("vertical")).toBeNull();
        return HttpResponse.json({
          items: [
            {
              concept_id: 1,
              vertical_norm: "generic",
              concept_key: "GENERIC_DIMENSION",
              name: "Generic Dimension",
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
              concept_id: 12,
              vertical_norm: "generic",
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
          page_size: 500,
          total: 2,
        });
      }),
      http.get("*/semantic/concept-column-maps", () => {
        conceptMapsRequestCount += 1;
        return HttpResponse.json({
          items: [],
          page: 1,
          page_size: 5,
          total: 0,
        });
      }),
      http.post("*/semantic/value-aliases", async ({ request }) => {
        createPayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            value_alias_id: 99,
            semantic_concept_id: createPayload.semantic_concept_id,
            canonical_value: createPayload.canonical_value,
            alias_value: createPayload.alias_value,
            match_kind: createPayload.match_kind,
            weight: createPayload.weight,
          },
          { status: 201 }
        );
      })
    );

    const user = userEvent.setup();
    renderSemanticPage(<ValueAliasesPage />, { route: "/semantic/value-aliases", preloadedState: adminState as any });

    await screen.findByRole("heading", { name: /value aliases/i });
    await user.click(screen.getByRole("button", { name: /create value alias/i }));

    const drawer = await screen.findByRole("dialog", { name: /create value alias/i });
    expect(within(drawer).queryByLabelText(/^semantic concept id$/i)).not.toBeInTheDocument();

    const conceptKeyInput = within(drawer).getByLabelText(/^concept key$/i);
    await waitFor(() => {
      expect(conceptKeyInput).toBeEnabled();
    });
    await user.type(within(drawer).getByLabelText(/^canonical value$/i), "2024");
    await user.type(within(drawer).getByLabelText(/^alias value$/i), "SY24");

    const createButton = within(drawer).getByRole("button", { name: /^create value alias$/i });
    expect(createButton).toBeDisabled();
    await user.type(conceptKeyInput, "SCHOOL_YEAR");
    await waitFor(() => {
      expect(conceptMapsRequestCount).toBeGreaterThan(0);
    });
    expect(createButton).toBeEnabled();
    await user.click(createButton);

    await waitFor(() => {
      expect(createPayload).toMatchObject({
        semantic_concept_id: 12,
        canonical_value: "2024",
        alias_value: "SY24",
      });
    });
  });

  it("uses concept-key dropdown in edit drawer, clears on vertical change, and submits mapped id", async () => {
    let updatePayload: Record<string, unknown> | null = null;
    let conceptMapsRequestCount = 0;

    server.use(
      http.get("*/semantic/value-aliases", () =>
        HttpResponse.json({
          items: [
            {
              value_alias_id: 7,
              vertical_norm: "education",
              semantic_concept_id: 12,
              concept_name: "School Year Concept",
              canonical_value: "2024",
              alias_value: "SY24",
              match_kind: "contains",
              weight: 1,
            },
          ],
          page: 1,
          page_size: 25,
          total: 1,
        })
      ),
      http.get("*/semantic/concepts/keys", async ({ request }) => {
        await new Promise((resolve) => window.setTimeout(resolve, 50));
        expect(new URL(request.url).searchParams.get("vertical")).toBeNull();
        return HttpResponse.json({ concept_keys: ["ATTENDANCE_RATE", "SCHOOL_YEAR", "TERM_CODE"] });
      }),
      http.get("*/semantic/concepts", async ({ request }) => {
        await new Promise((resolve) => window.setTimeout(resolve, 50));
        expect(new URL(request.url).searchParams.get("vertical")).toBeNull();
        return HttpResponse.json({
          items: [
            {
              concept_id: 12,
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
            {
              concept_id: 31,
              vertical_norm: "generic",
              concept_key: "TERM_CODE",
              name: "Term Code",
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
          page_size: 500,
          total: 2,
        });
      }),
      http.get("*/semantic/concept-column-maps", () => {
        conceptMapsRequestCount += 1;
        return HttpResponse.json({
          items: [],
          page: 1,
          page_size: 5,
          total: 0,
        });
      }),
      http.patch("*/semantic/value-aliases/7", async ({ request }) => {
        updatePayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            value_alias_id: 7,
            semantic_concept_id: updatePayload.semantic_concept_id,
            canonical_value: updatePayload.canonical_value,
            alias_value: updatePayload.alias_value,
            match_kind: updatePayload.match_kind,
            weight: updatePayload.weight,
          },
          { status: 200 }
        );
      })
    );

    const user = userEvent.setup();
    renderSemanticPage(<ValueAliasesPage />, { route: "/semantic/value-aliases", preloadedState: adminState as any });

    await screen.findByRole("heading", { name: /value aliases/i });
    expect(await screen.findByText("School Year Concept")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: /^sy24$/i }));

    const drawer = await screen.findByRole("dialog", { name: /edit value alias/i });
    const conceptKeyInput = within(drawer).getByLabelText(/^concept key$/i);
    await waitFor(() => {
      expect(conceptKeyInput).toHaveValue("SCHOOL_YEAR");
    });

    const saveButton = within(drawer).getByRole("button", { name: /^save$/i });
    await user.clear(conceptKeyInput);
    await user.type(conceptKeyInput, "TERM_CODE");
    await waitFor(() => {
      expect(conceptMapsRequestCount).toBeGreaterThan(0);
    });
    expect(saveButton).toBeEnabled();
    await user.click(saveButton);

    await waitFor(() => {
      expect(updatePayload).toMatchObject({
        semantic_concept_id: 31,
        canonical_value: "2024",
        alias_value: "SY24",
      });
    });
  });

  it("seeds the edit drawer concept key from the existing row response", async () => {
    server.use(
      http.get("*/semantic/value-aliases", () =>
        HttpResponse.json({
          rows: [
            {
              id: 2028,
              vertical_norm: "generic",
              semantic_concept_id: 31577,
              concept_key: "RACE_ETHNICITY",
              concept_name: "Race Ethnicity",
              canonical_value: "Black",
              alias_value: "African American",
              match_kind: "exact",
              weight: 1,
            },
          ],
          page: 1,
          page_size: 25,
          total: 1,
        })
      ),
      http.get("*/semantic/concepts/keys", () => HttpResponse.json({ concept_keys: ["RACE_ETHNICITY"] })),
      http.get("*/semantic/concepts", () =>
        HttpResponse.json({
          items: [],
          page: 1,
          page_size: 500,
          total: 0,
        })
      )
    );

    const user = userEvent.setup();
    renderSemanticPage(<ValueAliasesPage />, { route: "/semantic/value-aliases", preloadedState: adminState as any });

    await screen.findByRole("heading", { name: /value aliases/i });
    await user.click(await screen.findByRole("button", { name: /^african american$/i }));

    const drawer = await screen.findByRole("dialog", { name: /edit value alias/i });
    await waitFor(() => {
      expect(within(drawer).getByLabelText(/^concept key$/i)).toHaveValue("RACE_ETHNICITY");
    });
  });

  it("resolves selected concept key even when it is missing from the initial concept page", async () => {
    let createPayload: Record<string, unknown> | null = null;

    server.use(
      http.get("*/semantic/value-aliases", () =>
        HttpResponse.json({
          items: [],
          page: 1,
          page_size: 25,
          total: 0,
        })
      ),
      http.get("*/semantic/concepts/keys", ({ request }) => {
        expect(new URL(request.url).searchParams.get("vertical")).toBeNull();
        return HttpResponse.json({ concept_keys: ["RACE_ETHNICITY", "SCHOOL_YEAR"] });
      }),
      http.get("*/semantic/concepts", ({ request }) => {
        const url = new URL(request.url);
        const q = url.searchParams.get("q");
        if (q === "RACE_ETHNICITY") {
          return HttpResponse.json({
            items: [
              {
                concept_id: 365,
                vertical_norm: "generic",
                concept_key: "RACE_ETHNICITY",
                name: "Race Ethnicity",
                semantic_type: "filter",
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
            page_size: 25,
            total: 1,
          });
        }
        return HttpResponse.json({
          items: [
            {
              concept_id: 12,
              vertical_norm: "generic",
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
          page_size: 500,
          total: 600,
        });
      }),
      http.post("*/semantic/value-aliases", async ({ request }) => {
        createPayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            value_alias_id: 100,
            semantic_concept_id: createPayload.semantic_concept_id,
            canonical_value: createPayload.canonical_value,
            alias_value: createPayload.alias_value,
            match_kind: createPayload.match_kind,
            weight: createPayload.weight,
          },
          { status: 201 }
        );
      })
    );

    const user = userEvent.setup();
    renderSemanticPage(<ValueAliasesPage />, { route: "/semantic/value-aliases", preloadedState: adminState as any });

    await screen.findByRole("heading", { name: /value aliases/i });
    await user.click(screen.getByRole("button", { name: /create value alias/i }));

    const drawer = await screen.findByRole("dialog", { name: /create value alias/i });
    await user.type(within(drawer).getByLabelText(/^canonical value$/i), "Black");
    await user.type(within(drawer).getByLabelText(/^alias value$/i), "African American");

    const conceptKeyInput = within(drawer).getByLabelText(/^concept key$/i);
    await waitFor(() => {
      expect(conceptKeyInput).toBeEnabled();
    });
    await user.type(conceptKeyInput, "RACE_ETHNICITY");

    await waitFor(() => {
      expect(within(drawer).getByRole("button", { name: /^create value alias$/i })).toBeEnabled();
    });

    await user.click(within(drawer).getByRole("button", { name: /^create value alias$/i }));

    await waitFor(() => {
      expect(createPayload).toMatchObject({
        semantic_concept_id: 365,
        canonical_value: "Black",
        alias_value: "African American",
      });
    });
  });

  it("links to concept-column maps when a selected concept has no mappings", async () => {
    server.use(
      http.get("*/semantic/value-aliases", () =>
        HttpResponse.json({
          items: [],
          page: 1,
          page_size: 25,
          total: 0,
        })
      ),
      http.get("*/semantic/concepts/keys", () => HttpResponse.json({ concept_keys: ["RACE_ETHNICITY"] })),
      http.get("*/semantic/concepts", ({ request }) => {
        const url = new URL(request.url);
        const qValue = url.searchParams.get("q");
        if (qValue === "RACE_ETHNICITY") {
          return HttpResponse.json({
            items: [
              {
                concept_id: 365,
                vertical_norm: "generic",
                concept_key: "RACE_ETHNICITY",
                name: "Race Ethnicity",
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
            page_size: 25,
            total: 1,
          });
        }
        return HttpResponse.json({
          items: [],
          page: 1,
          page_size: 500,
          total: 0,
        });
      })
    );

    const user = userEvent.setup();
    renderSemanticPage(<ValueAliasesPage />, { route: "/semantic/value-aliases", preloadedState: adminState as any });

    await screen.findByRole("heading", { name: /value aliases/i });
    await user.click(screen.getByRole("button", { name: /create value alias/i }));

    const drawer = await screen.findByRole("dialog", { name: /create value alias/i });
    const conceptKeyInput = within(drawer).getByLabelText(/^concept key$/i);
    await waitFor(() => {
      expect(conceptKeyInput).toBeEnabled();
    });
    await user.type(conceptKeyInput, "RACE_ETHNICITY");

    const helperLink = await within(drawer).findByRole("link", { name: /map columns for this concept/i });
    expect(helperLink).toHaveAttribute(
      "href",
      "/semantic/concept-column-maps?semantic_concept_id=365"
    );
    expect(
      within(drawer).getByText(/value aliases alone will not rewrite planner filters/i)
    ).toBeInTheDocument();
  });
});
