import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

import MCPAppPrincipalsPage from "../pages/MCPAppPrincipalsPage";

const createMutateAsync = vi.fn();
const revokeMutateAsync = vi.fn();

vi.mock("@/features/system-admin/hooks", () => ({
  useOrganizations: () => ({
    data: { rows: [{ organization_id: "org1", name: "Acme" }] },
  }),
  useWorkspaceBindings: () => ({
    data: {
      rows: [
        {
          workspace_id: "ws1",
          workspace_name: "Workspace One",
          organization_id: "org1",
          organization_name: "Acme",
          datasource_name: "Warehouse",
        },
      ],
    },
  }),
}));

vi.mock("../hooks/useAccessControl", () => ({
  useMCPAppPrincipals: () => ({
    data: [
      {
        client_id: "qf_app_1",
        display_name: "District Agent",
        description: "Nightly access",
        owning_workspace_id: "ws1",
        owner_user_id: null,
        created_by: "admin-1",
        created_at: "2026-05-03T10:00:00",
        last_used_at: null,
        expires_at: null,
        revoked_at: null,
        rotation_required_at: null,
        grant: {
          enabled: true,
          allowed_tools: ["search_domains", "plan_query"],
          allowed_domain_keys: ["attendance"],
          can_preview: false,
          preview_row_limit: 100,
          expires_at: null,
          revoked_at: null,
          updated_at: null,
        },
      },
    ],
    isLoading: false,
    isError: false,
  }),
  useCreateMCPAppPrincipal: () => ({
    mutateAsync: createMutateAsync,
    isPending: false,
  }),
  useRevokeMCPAppPrincipal: () => ({
    mutateAsync: revokeMutateAsync,
    isPending: false,
  }),
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
        <MCPAppPrincipalsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MCPAppPrincipalsPage", () => {
  beforeEach(() => {
    createMutateAsync.mockReset();
    revokeMutateAsync.mockReset();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("renders workspace app principals", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: /mcp app principals/i })).toBeInTheDocument();
    expect(screen.getAllByText("Workspace One").length).toBeGreaterThan(0);
    expect(screen.getByText("District Agent")).toBeInTheDocument();
    expect(screen.getByText("search_domains, plan_query")).toBeInTheDocument();
    expect(screen.getByText("attendance")).toBeInTheDocument();
  });

  it("creates a principal and displays the one-time secret", async () => {
    createMutateAsync.mockResolvedValue({
      workspace_id: "ws1",
      client_secret: "qf_app_secret_once",
      item: {
        client_id: "qf_app_2",
        display_name: "New Agent",
        grant: { can_preview: true, allowed_tools: ["search_domains"], allowed_domain_keys: [], preview_row_limit: 25 },
      },
    });
    renderPage();

    await userEvent.type(screen.getByLabelText(/display name/i), "New Agent");
    await userEvent.click(screen.getByLabelText(/search domains/i));
    await userEvent.click(screen.getByLabelText(/allow preview rows/i));
    await userEvent.clear(screen.getByLabelText(/preview row limit/i));
    await userEvent.type(screen.getByLabelText(/preview row limit/i), "25");
    await userEvent.click(screen.getByRole("button", { name: /create app principal/i }));

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          display_name: "New Agent",
          allowed_tools: ["search_domains"],
          can_preview: true,
          preview_row_limit: 25,
        }),
      );
    });
    expect(await screen.findByText(/store this client secret now/i)).toBeInTheDocument();
    expect(screen.getByText(/qf_app_secret_once/)).toBeInTheDocument();
  });

  it("revokes an existing principal", async () => {
    revokeMutateAsync.mockResolvedValue({});
    renderPage();

    const card = screen.getByText("District Agent").closest(".ac-principal-card");
    expect(card).not.toBeNull();
    await userEvent.click(within(card as HTMLElement).getByRole("button", { name: /revoke/i }));
    const dialog = await screen.findByRole("dialog", { name: /revoke mcp app principal/i });
    await userEvent.click(within(dialog).getByRole("button", { name: /revoke principal/i }));

    await waitFor(() => {
      expect(revokeMutateAsync).toHaveBeenCalledWith("qf_app_1");
    });
  });
});
