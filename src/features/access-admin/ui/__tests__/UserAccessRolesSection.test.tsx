import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import UserAccessRolesSection from ".././UserAccessRolesSection";
import { server } from "../../../../qa/msw/server";

const roleCatalog = [
  { role_id: "1", role_name: "skills:admin" },
  { role_id: "2", role_name: "skills:user" },
  { role_id: "3", role_name: "workspace_admin" },
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
          direct_roles: [{ role_id: "2", role_name: "skills:user" }],
          effective_roles: [
            { role_id: "2", role_name: "skills:user" },
            { role_id: "3", role_name: "workspace_admin" },
          ],
        })
      )
    );

    renderSection(true);

    expect(await screen.findByText(/direct roles/i)).toBeInTheDocument();
    expect(await screen.findByLabelText(/remove role skills:user/i)).toBeInTheDocument();
    const effectiveSection = screen.getByText(/^effective roles$/i).closest(".mb-3");
    expect(effectiveSection).not.toBeNull();
    expect(within(effectiveSection as HTMLElement).getByText("workspace_admin")).toBeInTheDocument();
  });

  it("assigns two roles then removes one and refetches", async () => {
    const putPayloads: Array<{ role_names: string[] }> = [];
    const deletedRoleNames: string[] = [];
    let state = {
      direct_roles: [{ role_id: "2", role_name: "skills:user" }],
      effective_roles: [{ role_id: "2", role_name: "skills:user" }],
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
        const body = (await request.json()) as { role_names: string[] };
        putPayloads.push(body);
        state = {
          direct_roles: roleCatalog.filter((role) => body.role_names.includes(role.role_name)),
          effective_roles: roleCatalog.filter((role) => body.role_names.includes(role.role_name)),
        };
        return HttpResponse.json({
          user_id: "u-1",
          roles: state.direct_roles,
          count: state.direct_roles.length,
        });
      }),
      http.delete("*/users/:userId/roles/:roleId", ({ params }) => {
        const roleName = String(params.roleId);
        deletedRoleNames.push(roleName);
        state = {
          direct_roles: state.direct_roles.filter((role) => role.role_name !== roleName),
          effective_roles: state.effective_roles.filter((role) => role.role_name !== roleName),
        };
        return HttpResponse.json({
          user_id: "u-1",
          role_name: roleName,
          deleted: true,
        });
      })
    );

    const user = userEvent.setup();
    renderSection(true);

    const multiSelect = await screen.findByLabelText(/select direct roles/i);
    await user.selectOptions(multiSelect, ["skills:admin", "skills:user"]);
    await user.click(screen.getByRole("button", { name: /save direct roles/i }));

    await waitFor(() => {
      expect(putPayloads.length).toBeGreaterThan(0);
    });
    expect(putPayloads[0].role_names.sort()).toEqual(["skills:admin", "skills:user"]);

    await waitFor(() => {
      expect(screen.getByLabelText(/remove role skills:user/i)).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText(/remove role skills:user/i));

    await waitFor(() => {
      expect(deletedRoleNames).toContain("skills:user");
    });
    await waitFor(() => {
      expect(screen.queryByLabelText(/remove role skills:user/i)).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText(/remove role skills:admin/i)).toBeInTheDocument();
  });

  it("treats a missing user-role mapping as no assigned roles", async () => {
    server.use(
      http.get(roleCatalogPath, () => HttpResponse.json(roleCatalog)),
      http.get("*/users/:userId/roles", () =>
        HttpResponse.json({ error: "User missing" }, { status: 404 })
      )
    );

    renderSection(true);

    expect(await screen.findByText(/no direct roles assigned/i)).toBeInTheDocument();
    expect(screen.getByText(/no effective roles/i)).toBeInTheDocument();
    expect(screen.queryByText(/user no longer exists/i)).not.toBeInTheDocument();
  });

  it("renders validation errors when saving roles fails", async () => {
    server.use(
      http.get(roleCatalogPath, () => HttpResponse.json(roleCatalog)),
      http.get("*/users/:userId/roles", () =>
        HttpResponse.json({
          user_id: "u-1",
          direct_roles: [],
          effective_roles: [],
        })
      ),
      http.put("*/users/:userId/roles", () =>
        HttpResponse.json({ error: "role_names must be an array" }, { status: 400 })
      )
    );

    const user = userEvent.setup();
    renderSection(true);

    const multiSelect = await screen.findByLabelText(/select direct roles/i);
    await user.selectOptions(multiSelect, ["skills:admin"]);
    await user.click(screen.getByRole("button", { name: /save direct roles/i }));

    expect(await screen.findByText(/role_names must be an array/i)).toBeInTheDocument();
  });

  it("stages direct role updates in deferred mode without inline save", async () => {
    const onDraftChange = vi.fn();

    server.use(
      http.get(roleCatalogPath, () => HttpResponse.json(roleCatalog)),
      http.get("*/users/:userId/roles", () =>
        HttpResponse.json({
          user_id: "u-1",
          direct_roles: [{ role_id: "2", role_name: "skills:user" }],
          effective_roles: [{ role_id: "2", role_name: "skills:user" }],
        })
      )
    );

    const user = userEvent.setup();
    renderSection(true, { commitMode: "deferred", onDraftChange });

    expect(await screen.findByText(/direct roles/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save direct roles/i })).not.toBeInTheDocument();

    await user.click(await screen.findByLabelText(/remove role skills:user/i));

    await waitFor(() => {
      expect(onDraftChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          hasChanges: true,
          baselineRoleNames: ["skills:user"],
          selectedRoleNames: [],
        })
      );
    });
  });
});
