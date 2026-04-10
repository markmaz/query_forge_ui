import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { server } from "../../../../qa/msw/server";
import AliasesPage from "../AliasesPage";
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

describe("AliasesPage", () => {

  afterEach(() => {
    server.resetHandlers();
  });

  it("loads concept-key dropdown on create, refetches by vertical, and submits selected key", async () => {
    let createPayload: Record<string, unknown> | null = null;
    const requestedVerticals: Array<string | null> = [];

    server.use(
      http.get("*/semantic/concept-aliases", () =>
        HttpResponse.json({
          items: [],
          page: 1,
          page_size: 25,
          total: 0,
        })
      ),
      http.get("*/semantic/concepts/keys", async ({ request }) => {
        await new Promise((resolve) => window.setTimeout(resolve, 50));
        const url = new URL(request.url);
        const vertical = url.searchParams.get("vertical");
        requestedVerticals.push(vertical);
        if (vertical === "education") {
          return HttpResponse.json({ concept_keys: ["ATTENDANCE_RATE", "SCHOOL_YEAR"] });
        }
        return HttpResponse.json({ concept_keys: ["GENERIC_DIMENSION", "GENERIC_METRIC"] });
      }),
      http.post("*/semantic/concept-aliases", async ({ request }) => {
        createPayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            alias_id: 101,
            vertical_norm: createPayload.vertical_norm,
            alias_key: createPayload.alias_key,
            concept_key: createPayload.concept_key,
            match_kind: createPayload.match_kind,
            weight: createPayload.weight,
          },
          { status: 201 }
        );
      })
    );

    const user = userEvent.setup();
    renderSemanticPage(<AliasesPage />, { route: "/semantic/aliases", preloadedState: adminState as any });

    await screen.findByRole("heading", { name: /concept aliases/i });
    await user.click(screen.getByRole("button", { name: /create alias/i }));

    const drawer = await screen.findByRole("dialog", { name: /create alias/i });
    await waitFor(() => {
      expect(requestedVerticals).toContain(null);
    });

    const conceptKeyInput = within(drawer).getByLabelText(/^concept key$/i);
    await user.type(conceptKeyInput, "GENERIC_METRIC");
    expect(conceptKeyInput).toHaveValue("GENERIC_METRIC");

    const verticalInput = within(drawer).getByLabelText(/^vertical$/i);
    await user.type(verticalInput, "education");

    await waitFor(() => {
      expect(requestedVerticals).toContain("education");
    });
    await waitFor(() => {
      expect(conceptKeyInput).toHaveValue("");
    });

    await user.type(within(drawer).getByLabelText(/^alias key$/i), "attendance");
    const submitButton = within(drawer).getByRole("button", { name: /^create alias$/i });
    expect(submitButton).toBeDisabled();

    await user.type(conceptKeyInput, "ATTENDANCE_RATE");
    expect(submitButton).toBeEnabled();
    await user.click(submitButton);

    await waitFor(() => {
      expect(createPayload).toMatchObject({
        vertical_norm: "education",
        alias_key: "attendance",
        concept_key: "ATTENDANCE_RATE",
      });
    });
  });

  it("shows inline error for concept-key lookup failures and blocks create submit", async () => {
    server.use(
      http.get("*/semantic/concept-aliases", () =>
        HttpResponse.json({
          items: [],
          page: 1,
          page_size: 25,
          total: 0,
        })
      ),
      http.get("*/semantic/concepts/keys", () =>
        HttpResponse.json({ error: "failed" }, { status: 500 })
      )
    );

    const user = userEvent.setup();
    renderSemanticPage(<AliasesPage />, { route: "/semantic/aliases", preloadedState: adminState as any });

    await screen.findByRole("heading", { name: /concept aliases/i });
    await user.click(screen.getByRole("button", { name: /create alias/i }));

    const drawer = await screen.findByRole("dialog", { name: /create alias/i });
    expect(await within(drawer).findByText(/unable to load semantic concept keys/i)).toBeInTheDocument();
    expect(within(drawer).getByLabelText(/^concept key$/i)).toBeDisabled();
    expect(within(drawer).getByRole("button", { name: /^create alias$/i })).toBeDisabled();
  });

  it("applies concept-key dropdown behavior in edit drawer and submits selected key", async () => {
    let updatePayload: Record<string, unknown> | null = null;
    const requestedVerticals: Array<string | null> = [];

    server.use(
      http.get("*/semantic/concept-aliases", () =>
        HttpResponse.json({
          items: [
            {
              alias_id: 5,
              vertical_norm: "education",
              alias_key: "school_year_alias",
              concept_key: "SCHOOL_YEAR",
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
        const url = new URL(request.url);
        const vertical = url.searchParams.get("vertical");
        requestedVerticals.push(vertical);
        if (vertical === "education") {
          return HttpResponse.json({ concept_keys: ["ATTENDANCE_RATE", "SCHOOL_YEAR"] });
        }
        if (vertical === "higher_ed") {
          return HttpResponse.json({ concept_keys: ["TERM_CODE", "UNIVERSITY_NAME"] });
        }
        return HttpResponse.json({ concept_keys: ["GENERIC_DIMENSION"] });
      }),
      http.patch("*/semantic/concept-aliases/5", async ({ request }) => {
        updatePayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            alias_id: 5,
            vertical_norm: updatePayload.vertical_norm,
            alias_key: updatePayload.alias_key,
            concept_key: updatePayload.concept_key,
            match_kind: updatePayload.match_kind,
            weight: updatePayload.weight,
          },
          { status: 200 }
        );
      })
    );

    const user = userEvent.setup();
    renderSemanticPage(<AliasesPage />, { route: "/semantic/aliases", preloadedState: adminState as any });

    await screen.findByRole("heading", { name: /concept aliases/i });
    await user.click(await screen.findByRole("button", { name: /^school_year_alias$/i }));

    const drawer = await screen.findByRole("dialog", { name: /edit alias/i });
    await waitFor(() => {
      expect(requestedVerticals).toContain("education");
    });

    const conceptKeyInput = within(drawer).getByLabelText(/^concept key$/i);
    expect(conceptKeyInput).toHaveValue("SCHOOL_YEAR");

    const verticalInput = within(drawer).getByLabelText(/^vertical$/i);
    await user.clear(verticalInput);
    await user.type(verticalInput, "higher_ed");

    await waitFor(() => {
      expect(requestedVerticals).toContain("higher_ed");
    });
    await waitFor(() => {
      expect(conceptKeyInput).toHaveValue("");
    });

    const saveButton = within(drawer).getByRole("button", { name: /^save$/i });
    expect(saveButton).toBeDisabled();

    await user.type(conceptKeyInput, "TERM_CODE");
    expect(saveButton).toBeEnabled();
    await user.click(saveButton);

    await waitFor(() => {
      expect(updatePayload).toMatchObject({
        vertical_norm: "higher_ed",
        alias_key: "school_year_alias",
        concept_key: "TERM_CODE",
      });
    });
  });

  it("filters loaded aliases by concept key and alias search text", async () => {
    server.use(
      http.get("*/semantic/concept-aliases", () =>
        HttpResponse.json({
          items: [
            {
              alias_id: 1,
              vertical_norm: "education",
              alias_key: "school year",
              concept_key: "SCHOOL_YEAR",
              match_kind: "contains",
              weight: 1,
            },
            {
              alias_id: 2,
              vertical_norm: "education",
              alias_key: "attendance pct",
              concept_key: "ATTENDANCE_RATE",
              match_kind: "contains",
              weight: 1,
            },
          ],
          page: 1,
          page_size: 25,
          total: 2,
        })
      ),
      http.get("*/semantic/concepts/keys", () => HttpResponse.json({ concept_keys: [] }))
    );

    const user = userEvent.setup();
    renderSemanticPage(<AliasesPage />, { route: "/semantic/aliases", preloadedState: adminState as any });

    await screen.findByRole("button", { name: /^school year$/i });
    expect(screen.getByRole("button", { name: /^attendance pct$/i })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/concept key/i), "school year");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^school year$/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^attendance pct$/i })).not.toBeInTheDocument();
    });

    await user.clear(screen.getByPlaceholderText(/concept key/i));
    await user.type(screen.getByPlaceholderText(/search aliases/i), "attendance");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^attendance pct$/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^school year$/i })).not.toBeInTheDocument();
    });
  });
});
