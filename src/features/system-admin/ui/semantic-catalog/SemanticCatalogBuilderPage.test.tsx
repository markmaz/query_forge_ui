import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SemanticCatalogBuilderPage from "./SemanticCatalogBuilderPage";
import { SemanticCatalogBuildApiError } from "@/features/system-admin/api/semanticCatalog";

const mocks = vi.hoisted(() => ({
  buildSemanticCatalog: vi.fn(),
  fetchDomains: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/features/system-admin/api", async () => {
  const actual = await vi.importActual<typeof import("@/features/system-admin/api")>("@/features/system-admin/api");
  return {
    ...actual,
    buildSemanticCatalog: mocks.buildSemanticCatalog,
  };
});

vi.mock("react-toastify", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

vi.mock("@/shared/services/queryStudioAdminApi", () => ({
  fetchDomains: mocks.fetchDomains,
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SemanticCatalogBuilderPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function successfulResponse(dryRun: boolean) {
  return {
    result: {
      workspace_id: "ws-1",
      domain_id: 3,
      domain_name: "Sales Performance",
      profile_count: 123,
      enriched_count: 123,
      concepts_upserted: 40,
      aliases_upserted: 55,
      relationships_upserted: 70,
      value_aliases_upserted: 10,
      derived_metrics_created: 3,
      index_items_count: 40,
      dry_run: dryRun,
      concept_preview: [{ concept_key: "REVENUE" }],
      alias_preview: [{ alias_key: "sales" }],
      relationship_preview: [{ rel_type: "belongs_to_domain" }],
      index_preview: [{ text: "Sales Performance" }],
    },
  };
}

describe("SemanticCatalogBuilderPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchDomains.mockResolvedValue({
      rows: [
        { id: 3, name: "Sales Performance" },
        { id: 8, name: "Student Outcomes" },
      ],
    });
  });

  it("runs dry-run preview and renders summary/previews", async () => {
    mocks.buildSemanticCatalog.mockResolvedValue(successfulResponse(true));

    const user = userEvent.setup();
    renderPage();

    const domainSelect = screen.getByLabelText(/^domain$/i);
    await waitFor(() => expect(domainSelect).toBeEnabled());
    await user.selectOptions(domainSelect, "3");
    await user.click(screen.getByRole("button", { name: /preview build/i }));

    await waitFor(() => {
      expect(mocks.buildSemanticCatalog).toHaveBeenCalledWith(
        expect.objectContaining({ domain_id: 3, dry_run: true }),
      );
    });

    expect(await screen.findByRole("heading", { name: /result summary/i })).toBeInTheDocument();
    expect(screen.getByText(/concepts \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText("REVENUE")).toBeInTheDocument();
    expect(screen.getByLabelText(/domain name/i)).toHaveValue("Sales Performance");
  });

  it("runs write-mode build from confirmation modal", async () => {
    mocks.buildSemanticCatalog.mockResolvedValue(successfulResponse(false));

    const user = userEvent.setup();
    renderPage();

    const domainSelect = screen.getByLabelText(/^domain$/i);
    await waitFor(() => expect(domainSelect).toBeEnabled());
    await user.selectOptions(domainSelect, "8");
    await user.click(screen.getByRole("button", { name: /^run build$/i }));

    const dialog = await screen.findByRole("dialog", { name: /confirm semantic catalog build/i });
    await user.click(within(dialog).getByRole("button", { name: /^run build$/i }));

    await waitFor(() => {
      expect(mocks.buildSemanticCatalog).toHaveBeenCalledWith(
        expect.objectContaining({ domain_id: 8, dry_run: false }),
      );
    });

    expect(await screen.findByText(/write mode/i)).toBeInTheDocument();
  });

  it("renders backend validation errors from 400", async () => {
    mocks.buildSemanticCatalog.mockRejectedValue(
      new SemanticCatalogBuildApiError("Invalid request", 400, {
        domain_id: ["required"],
      }),
    );

    const user = userEvent.setup();
    renderPage();

    const domainSelect = screen.getByLabelText(/^domain$/i);
    await waitFor(() => expect(domainSelect).toBeEnabled());
    await user.selectOptions(domainSelect, "3");
    await user.click(screen.getByRole("button", { name: /preview build/i }));

    expect(await screen.findByText("Invalid request")).toBeInTheDocument();
    expect(screen.getByText(/domain_id: required/i)).toBeInTheDocument();
  });

  it("renders access denied message for 403", async () => {
    mocks.buildSemanticCatalog.mockRejectedValue(
      new SemanticCatalogBuildApiError("Admin access required", 403),
    );

    const user = userEvent.setup();
    renderPage();

    const domainSelect = screen.getByLabelText(/^domain$/i);
    await waitFor(() => expect(domainSelect).toBeEnabled());
    await user.selectOptions(domainSelect, "3");
    await user.click(screen.getByRole("button", { name: /preview build/i }));

    expect(await screen.findByText(/admin access required/i)).toBeInTheDocument();
  });
});
