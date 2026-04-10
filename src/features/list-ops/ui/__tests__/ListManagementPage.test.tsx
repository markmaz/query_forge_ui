import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ListManagementPage from ".././ListManagementPage";
import { ValueOverrideMutationError } from "../../../../shared/services/valueOverride";

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

const mocks = vi.hoisted(() => ({
  fetchValueOverrideIndex: vi.fn(),
  fetchValueOverridePreview: vi.fn(),
  patchValueOverrideVisibility: vi.fn(),
  deleteValueOverride: vi.fn(),
  uploadListFile: vi.fn(),
  getVisibleValueOverrides: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  currentUserId: "owner-1",
}));

vi.mock("../../../../shared/runtime/hooks", () => ({
  useAppSelector: (selector: (state: any) => unknown) =>
    selector({
      user: {
        user: {
          user_id: mocks.currentUserId,
        },
      },
    }),
}));

vi.mock("react-toastify", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

vi.mock("../../../../shared/services/queryStudioAdminApi", () => ({
  getVisibleValueOverrides: mocks.getVisibleValueOverrides,
}));

vi.mock("../../../../shared/services/valueOverride", async () => {
  const actual = await vi.importActual<
    typeof import("../../../../shared/services/valueOverride")
  >("../../../../shared/services/valueOverride");
  return {
    ...actual,
    fetchValueOverrideIndex: mocks.fetchValueOverrideIndex,
    fetchValueOverridePreview: mocks.fetchValueOverridePreview,
    patchValueOverrideVisibility: mocks.patchValueOverrideVisibility,
    deleteValueOverride: mocks.deleteValueOverride,
    uploadListFile: mocks.uploadListFile,
  };
});

vi.mock(".././components/UploadWizardModal", () => ({
  default: () => null,
}));

vi.mock(".././components/PreviewListDrawer", () => ({
  default: ({
    context,
    onSharedToggle,
    currentUserId,
  }: {
    context: {
      section: "regions" | "npiCategories" | "serviceLines";
      row: { id: string; name: string; userId?: string };
    } | null;
    onSharedToggle?: (
      section: "regions" | "npiCategories" | "serviceLines",
      listId: string,
      isShared: boolean,
    ) => Promise<void>;
    currentUserId?: string | null;
  }) => {
    if (!context) return null;
    const canModify = Boolean(
      currentUserId &&
      context.row.userId &&
      context.row.userId === currentUserId,
    );
    return (
      <div>
        <div>Preview: {context.row.name}</div>
        <button
          type="button"
          onClick={() => {
            void onSharedToggle?.(context.section, context.row.id, true).catch(
              () => undefined,
            );
          }}
          disabled={!canModify}
        >
          Toggle shared
        </button>
      </div>
    );
  },
}));

const makeIndex = (
  rows: Array<{
    listId: string;
    listName: string;
    owner: string;
    userId?: string | null;
    isShared: boolean;
  }>,
) => ({
  regions: rows.map((row) => ({
    ...row,
    createdAt: "2026-02-12T00:00:00.000Z",
    updatedAt: "2026-02-12T00:00:00.000Z",
    expiresAt: null,
    rowCount: 4,
  })),
  npiCategories: [],
  serviceLines: [],
});

const previewPayload = {
  listId: "list-1",
  listName: "List 1",
  listType: "regions" as const,
  columns: [{ name: "region_code" }],
  rows: [{ region_code: "NE" }],
  totalRows: 1,
};

describe("ListManagementPage authorization behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentUserId = "owner-1";
    mocks.getVisibleValueOverrides.mockResolvedValue({
      index: {},
      hasShared: true,
    });
    mocks.fetchValueOverridePreview.mockResolvedValue(previewPayload);
    mocks.patchValueOverrideVisibility.mockResolvedValue({
      listId: "list-1",
      type: "regions",
      isShared: true,
    });
    mocks.deleteValueOverride.mockResolvedValue(undefined);
  });

  it("shows permission message on PATCH 403 and refreshes index without mutating shared state", async () => {
    mocks.fetchValueOverrideIndex
      .mockResolvedValueOnce(
        makeIndex([
          {
            listId: "list-1",
            listName: "Owned Regions List",
            owner: "Owner",
            userId: "owner-1",
            isShared: false,
          },
        ]),
      )
      .mockResolvedValueOnce(
        makeIndex([
          {
            listId: "list-1",
            listName: "Owned Regions List",
            owner: "Owner",
            userId: "owner-1",
            isShared: false,
          },
        ]),
      );
    mocks.patchValueOverrideVisibility.mockRejectedValue(
      new ValueOverrideMutationError(
        "permission_denied",
        "You do not have permission to modify this list.",
        403,
      ),
    );

    renderWithQuery(<ListManagementPage />);
    const user = userEvent.setup();

    expect(await screen.findByText("Owned Regions List")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^preview$/i }));
    expect(
      await screen.findByText("Preview: Owned Regions List"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /toggle shared/i }));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "You do not have permission to modify this list.",
      );
      expect(mocks.fetchValueOverrideIndex).toHaveBeenCalledTimes(2);
    });
    expect(mocks.patchValueOverrideVisibility).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Shared")).not.toBeInTheDocument();
  });

  it("shows permission message on DELETE 403 and keeps row in place", async () => {
    mocks.fetchValueOverrideIndex
      .mockResolvedValueOnce(
        makeIndex([
          {
            listId: "list-1",
            listName: "Owned Regions List",
            owner: "Owner",
            userId: "owner-1",
            isShared: false,
          },
        ]),
      )
      .mockResolvedValueOnce(
        makeIndex([
          {
            listId: "list-1",
            listName: "Owned Regions List",
            owner: "Owner",
            userId: "owner-1",
            isShared: false,
          },
        ]),
      );
    mocks.deleteValueOverride.mockRejectedValue(
      new ValueOverrideMutationError(
        "permission_denied",
        "You do not have permission to modify this list.",
        403,
      ),
    );

    renderWithQuery(<ListManagementPage />);
    const user = userEvent.setup();

    expect(await screen.findByText("Owned Regions List")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /delete owned regions list/i }),
    );
    await user.type(screen.getByPlaceholderText('Type "Delete"'), "Delete");
    const modal = screen.getByRole("dialog");
    await user.click(within(modal).getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "You do not have permission to modify this list.",
      );
      expect(mocks.fetchValueOverrideIndex).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText("Owned Regions List")).toBeInTheDocument();
  });

  it("handles DELETE 404 gracefully, refreshes index, and removes stale row", async () => {
    mocks.fetchValueOverrideIndex
      .mockResolvedValueOnce(
        makeIndex([
          {
            listId: "list-1",
            listName: "Stale Regions List",
            owner: "Owner",
            userId: "owner-1",
            isShared: false,
          },
        ]),
      )
      .mockResolvedValueOnce(makeIndex([]));
    mocks.deleteValueOverride.mockRejectedValue(
      new ValueOverrideMutationError(
        "not_found",
        "List no longer exists.",
        404,
      ),
    );

    renderWithQuery(<ListManagementPage />);
    const user = userEvent.setup();

    expect(await screen.findByText("Stale Regions List")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /delete stale regions list/i }),
    );

    await user.type(screen.getByPlaceholderText('Type "Delete"'), "Delete");
    const modal = screen.getByRole("dialog");
    await user.click(within(modal).getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith("List no longer exists.");
      expect(mocks.fetchValueOverrideIndex).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText("Stale Regions List")).not.toBeInTheDocument();
  });

  it("handles PATCH 404 gracefully, refreshes index, and removes stale row", async () => {
    mocks.fetchValueOverrideIndex
      .mockResolvedValueOnce(
        makeIndex([
          {
            listId: "list-1",
            listName: "Stale Shared Toggle",
            owner: "Owner",
            userId: "owner-1",
            isShared: false,
          },
        ]),
      )
      .mockResolvedValueOnce(makeIndex([]));
    mocks.patchValueOverrideVisibility.mockRejectedValue(
      new ValueOverrideMutationError(
        "not_found",
        "List no longer exists.",
        404,
      ),
    );

    renderWithQuery(<ListManagementPage />);
    const user = userEvent.setup();

    expect(await screen.findByText("Stale Shared Toggle")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^preview$/i }));
    expect(
      await screen.findByText("Preview: Stale Shared Toggle"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /toggle shared/i }));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith("List no longer exists.");
      expect(mocks.fetchValueOverrideIndex).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText("Stale Shared Toggle")).not.toBeInTheDocument();
  });

  it("loads index and preview for shared lists", async () => {
    mocks.fetchValueOverrideIndex.mockResolvedValue(
      makeIndex([
        {
          listId: "shared-1",
          listName: "Shared Regions List",
          owner: "Teammate",
          userId: "teammate-1",
          isShared: true,
        },
      ]),
    );

    renderWithQuery(<ListManagementPage />);
    const user = userEvent.setup();

    expect(await screen.findByText("Shared Regions List")).toBeInTheDocument();
    expect(screen.getByText("Shared")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^preview$/i }));

    await waitFor(() => {
      expect(mocks.fetchValueOverridePreview).toHaveBeenCalledWith(
        "regions",
        "shared-1",
        {
          limit: 100,
          offset: 0,
          includeExpired: false,
        },
      );
    });
    expect(
      screen.getByText("Preview: Shared Regions List"),
    ).toBeInTheDocument();
  });
});
