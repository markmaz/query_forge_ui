import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryTreeMocks = vi.hoisted(() => ({
  hydrateQueryTree: vi.fn(),
  purgeSavedQuery: vi.fn(),
  createFolder: vi.fn(),
  deleteFolder: vi.fn(),
  deleteSavedQuery: vi.fn(),
  fetchSavedQuery: vi.fn(),
  purgeFolder: vi.fn(),
  renameFolder: vi.fn(),
  restoreFolder: vi.fn(),
  restoreSavedQuery: vi.fn(),
  saveSavedQueryToLibrary: vi.fn(),
  trashFolder: vi.fn(),
  updateSavedQuery: vi.fn(),
  createSavedQuery: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../../../shared/services/queryTreeApi", () => ({
  createFolder: queryTreeMocks.createFolder,
  deleteFolder: queryTreeMocks.deleteFolder,
  deleteSavedQuery: queryTreeMocks.deleteSavedQuery,
  fetchSavedQuery: queryTreeMocks.fetchSavedQuery,
  hydrateQueryTree: queryTreeMocks.hydrateQueryTree,
  purgeFolder: queryTreeMocks.purgeFolder,
  purgeSavedQuery: queryTreeMocks.purgeSavedQuery,
  renameFolder: queryTreeMocks.renameFolder,
  restoreFolder: queryTreeMocks.restoreFolder,
  restoreSavedQuery: queryTreeMocks.restoreSavedQuery,
  saveSavedQueryToLibrary: queryTreeMocks.saveSavedQueryToLibrary,
  trashFolder: queryTreeMocks.trashFolder,
  updateSavedQuery: queryTreeMocks.updateSavedQuery,
  createSavedQuery: queryTreeMocks.createSavedQuery,
}));

vi.mock("react-toastify", () => ({
  toast: toastMocks,
}));

vi.mock("../../../shared/runtime/hooks", () => ({
  useAppSelector: (selector: (state: any) => unknown) =>
    selector({
      user: {
        user: {
          user_id: "user-1",
          display_name: "Reviewer",
          first_name: "Review",
          last_name: "User",
          email: "reviewer@example.com",
        },
      },
    }),
}));

vi.mock("../../../shared/services/auth", () => ({
  getRolesFromToken: vi.fn(() => []),
}));

vi.mock("../../../shared/runtime/accessTokenStore", () => ({
  getAccessToken: vi.fn(() => null),
}));

import { useQueryForgeSavedQueries } from "./useQueryForgeSavedQueries";

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useQueryForgeSavedQueries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryTreeMocks.hydrateQueryTree.mockResolvedValue({
      trees: {
        library: { view: "library", rootNodes: [] },
        shared: { view: "shared", rootNodes: [] },
        my: { view: "my", rootNodes: [] },
        trash: {
          view: "trash",
          rootNodes: [
            {
              nodeType: "query",
              id: "trash-q-1",
              name: "Deleted Query",
              deletedAt: "2026-04-10T10:00:00Z",
            },
          ],
        },
      },
      recent: [],
    });
    queryTreeMocks.purgeSavedQuery.mockResolvedValue({ ok: true });
  });

  it("purges a trash query and refetches the tree", async () => {
    const { result } = renderHook(
      () =>
        useQueryForgeSavedQueries({
          setColumnsSearchTerm: vi.fn(),
          setCurrentPage: vi.fn(),
          setSqlJson: vi.fn(),
          setOpenQuery: vi.fn(),
          ensureToolMeta: (next) => next,
          normalizeSqlJsonPayload: (raw) => raw as any,
        }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => {
      expect(queryTreeMocks.hydrateQueryTree).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.handleSavedQueriesAction({
        type: "PURGE_QUERY",
        queryId: "trash-q-1",
      });
    });

    expect(queryTreeMocks.purgeSavedQuery).toHaveBeenCalledWith("trash-q-1");
    expect(toastMocks.success).toHaveBeenCalledWith("Query permanently deleted.");
    await waitFor(() => {
      expect(queryTreeMocks.hydrateQueryTree).toHaveBeenCalledTimes(2);
    });
  });
});
