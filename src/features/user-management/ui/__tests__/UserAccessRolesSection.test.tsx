import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import UserAccessRolesSection from ".././UserAccessRolesSection";
import { server } from "../../../../test/msw/server";

const roleCatalog = [
  { role_id: "admin", role_name: "Admin" },
  { role_id: "viewer", role_name: "Viewer" },
  { role_id: "editor", role_name: "Editor" },
];
const roleCatalogPath = /^https?:\/\/[^/]+(?:\/api\/v1)?\/roles\/?$/;

const renderSection = (
  editable = true,
  props?: Partial<ComponentProps<typeof UserAccessRolesSection>>
) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <UserAccessRolesSection userId="u-1" editable={editable} {...props} />
    </QueryClientProvider>
  );
};

describe("UserAccessRolesSection", () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it("renders direct and effective roles", async () => {
    server.use(
      http.get(roleCatalogPath, () => HttpResponse.json(roleCatalog)),
      http.get("*/users/:userId/roles", () =>
        HttpResponse.json({
          user_id: "u-1",
          direct_roles: [{ role_id: "viewer", role_name: "Viewer" }],
          effective_roles: [
            { role_id: "viewer", role_name: "Viewer" },
            { role_id: "editor", role_name: "Editor" },
          ],
        })
      )
    );

    renderSection(true);

    expect(await screen.findByText(/direct roles/i)).toBeInTheDocument();
    expect(await screen.findByLabelText(/remove role viewer/i)).toBeInTheDocument();
    const effectiveSection = screen.getByText(/^effective roles$/i).closest(".mb-3");
    expect(effectiveSection).not.toBeNull();
    expect(within(effectiveSection as HTMLElement).getByText("Editor")).toBeInTheDocument();
  });

  it("assigns two roles then removes one and refetches", async () => {
    const putPayloads: Array<{ role_ids: string[] }> = [];
    const deletedRoleIds: string[] = [];
    let state = {
      direct_roles: [{ role_id: "viewer", role_name: "Viewer" }],
      effective_roles: [{ role_id: "viewer", role_name: "Viewer" }],
    };

    server.use(
      http.get(roleCatalogPath, () => HttpResponse.json(roleCatalog)),
      http.get("*/users/:userId/roles", () =>
        HttpResponse.json({
          user_id: "u-1",
          direct_roles: state.direct_roles,
          effective_roles: state.effective_roles,
        })
      ),
      http.put("*/users/:userId/roles", async ({ request }) => {
        const body = (await request.json()) as { role_ids: string[] };
        putPayloads.push(body);
        state = {
          direct_roles: roleCatalog.filter((role) => body.role_ids.includes(role.role_id)),
          effective_roles: roleCatalog.filter((role) => body.role_ids.includes(role.role_id)),
        };
        return HttpResponse.json({
          user_id: "u-1",
          roles: state.direct_roles,
          count: state.direct_roles.length,
        });
      }),
      http.delete("*/users/:userId/roles/:roleId", ({ params }) => {
        const roleId = String(params.roleId);
        deletedRoleIds.push(roleId);
        state = {
          direct_roles: state.direct_roles.filter((role) => role.role_id !== roleId),
          effective_roles: state.effective_roles.filter((role) => role.role_id !== roleId),
        };
        return HttpResponse.json({
          user_id: "u-1",
          role_id: roleId,
          deleted: true,
        });
      })
    );

    const user = userEvent.setup();
    renderSection(true);

    const multiSelect = await screen.findByLabelText(/select direct roles/i);
    await user.selectOptions(multiSelect, ["admin", "viewer"]);
    await user.click(screen.getByRole("button", { name: /save direct roles/i }));

    await waitFor(() => {
      expect(putPayloads.length).toBeGreaterThan(0);
    });
    expect(putPayloads[0].role_ids.sort()).toEqual(["admin", "viewer"]);

    await waitFor(() => {
      expect(screen.getByLabelText(/remove role viewer/i)).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText(/remove role viewer/i));

    await waitFor(() => {
      expect(deletedRoleIds).toContain("viewer");
    });
    await waitFor(() => {
      expect(screen.queryByLabelText(/remove role viewer/i)).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText(/remove role admin/i)).toBeInTheDocument();
  });

  it("renders validation and not-found errors", async () => {
    server.use(
      http.get(roleCatalogPath, () => HttpResponse.json(roleCatalog)),
      http.get("*/users/:userId/roles", () =>
        HttpResponse.json({ error: "User missing" }, { status: 404 })
      ),
      http.put("*/users/:userId/roles", () =>
        HttpResponse.json({ error: "role_ids must be array" }, { status: 400 })
      )
    );

    const user = userEvent.setup();
    renderSection(true);

    expect(await screen.findByText(/user no longer exists/i)).toBeInTheDocument();

    const multiSelect = await screen.findByLabelText(/select direct roles/i);
    await user.selectOptions(multiSelect, ["admin"]);
    await user.click(screen.getByRole("button", { name: /save direct roles/i }));

    expect(await screen.findByText(/role_ids must be array/i)).toBeInTheDocument();
  });

  it("stages direct role updates in deferred mode without inline save", async () => {
    const onDraftChange = vi.fn();

    server.use(
      http.get(roleCatalogPath, () => HttpResponse.json(roleCatalog)),
      http.get("*/users/:userId/roles", () =>
        HttpResponse.json({
          user_id: "u-1",
          direct_roles: [{ role_id: "viewer", role_name: "Viewer" }],
          effective_roles: [{ role_id: "viewer", role_name: "Viewer" }],
        })
      )
    );

    const user = userEvent.setup();
    renderSection(true, { commitMode: "deferred", onDraftChange });

    expect(await screen.findByText(/direct roles/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save direct roles/i })).not.toBeInTheDocument();

    await user.click(await screen.findByLabelText(/remove role viewer/i));

    await waitFor(() => {
      expect(onDraftChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          hasChanges: true,
          baselineRoleIds: ["viewer"],
          selectedRoleIds: [],
        })
      );
    });
  });
});
