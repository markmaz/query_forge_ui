import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import UserRoleAssignmentDrawer from "../components/UserRoleAssignmentDrawer";

vi.mock("@/features/system-admin/hooks", () => ({
  useWorkspaceBindings: () => ({
    data: {
      rows: [
        {
          workspace_id: "ws1",
          workspace_name: "Workspace One",
          organization_name: "Acme",
          datasource_name: "Warehouse",
        },
      ],
    },
  }),
}));

vi.mock("../hooks/useAccessControl", () => ({
  useAccessUser: () => ({
    data: {
      display_name: "Ada Lovelace",
      email: "ada@example.com",
      first_name: "Ada",
      last_name: "Lovelace",
      status: "Active",
      workspaces: [{ workspace_id: "ws1" }],
    },
  }),
  useAccessRoles: () => ({
    data: [
      {
        role_id: "r-library",
        role_key: "library_admin",
        role_name: "library_admin",
        display_name: "Library Admin",
        description: "Can manage the shared library.",
        category: "system",
        feature_key: null,
        access_level: "admin",
      },
    ],
  }),
  useWorkspaceRoleAssignments: () => ({
    data: [
      {
        assignment_id: "1",
        role_key: "skills:admin",
        display_name: "Skills Admin",
      },
    ],
    isLoading: false,
    isError: false,
  }),
  useEffectiveAccessSummary: () => ({
    data: [
      {
        feature_key: "skills",
        feature_name: "Skills",
        feature_enabled: true,
        access_level: "admin",
        status: "granted",
        assigned_role_key: "skills:admin",
        assigned_role_name: "Skills Admin",
        message: "Skills Admin assigned for this workspace.",
      },
    ],
    isLoading: false,
    isError: false,
  }),
  useAssignWorkspaceRole: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useRevokeWorkspaceRole: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

describe("UserRoleAssignmentDrawer", () => {
  it("renders workspace-scoped role and effective access details", () => {
    render(
      <UserRoleAssignmentDrawer open userId="user-1" userEmail="ada@example.com" onClose={() => undefined} />,
    );

    expect(screen.getByText("Workspace Role Assignment")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getAllByText("Skills Admin").length).toBeGreaterThan(0);
    expect(screen.getByRole("option", { name: "Library Admin" })).toBeInTheDocument();
    expect(screen.getByText("Effective Access")).toBeInTheDocument();
    expect(screen.getByText(/only global role is/i)).toBeInTheDocument();
  });
});
