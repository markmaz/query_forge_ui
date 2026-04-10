import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { SavedQueriesTreeSection } from "./SavedQueriesTreeSection";
import type { SavedQueriesAction, TreeResponse } from "../../domain-state/savedQueries";

const emptyTree = (view: TreeResponse["view"]): TreeResponse => ({ view, rootNodes: [] });

function renderSection(props?: Partial<ComponentProps<typeof SavedQueriesTreeSection>>) {
  const onAction = vi.fn<(action: SavedQueriesAction) => void>();
  render(
    <SavedQueriesTreeSection
      search=""
      trees={{
        library: emptyTree("library"),
        shared: emptyTree("shared"),
        my: {
          view: "my",
          rootNodes: [
            {
              nodeType: "query",
              id: "my-q-1",
              name: "My Query",
              folderId: null,
              scope: "MINE",
              queryType: "query_builder",
            },
          ],
        },
        trash: emptyTree("trash"),
      }}
      recent={[]}
      onSelectQuery={() => {}}
      onAction={onAction}
      {...props}
    />,
  );
  return { onAction };
}

describe("SavedQueriesTreeSection", () => {
  it("shows Save to Library for personal queries when allowed", async () => {
    const user = userEvent.setup();
    const { onAction } = renderSection({ canSaveToLibrary: true });

    const row = screen.getByText("My Query").closest(".nq-tree-row");
    expect(row).not.toBeNull();
    const menuButton = row!.querySelector('button[title="Options"]') as HTMLButtonElement;
    await user.click(menuButton);
    await user.click(screen.getByText("Save to Library"));

    expect(onAction).toHaveBeenCalledWith({ type: "SAVE_TO_LIBRARY", queryId: "my-q-1" });
  });

  it("shows full library query actions for library admin", async () => {
    const user = userEvent.setup();
    const libraryTree: TreeResponse = {
      view: "library",
      rootNodes: [
        {
          nodeType: "query",
          id: "lib-q-1",
          name: "Library Query",
          folderId: null,
          scope: "LIBRARY",
          queryType: "query_builder",
        },
      ],
    };

    render(
      <SavedQueriesTreeSection
        search=""
        trees={{
          library: libraryTree,
          shared: emptyTree("shared"),
          my: emptyTree("my"),
          trash: emptyTree("trash"),
        }}
        recent={[]}
        canDeleteLibraryQueries
        canManageLibrary
        onSelectQuery={() => {}}
        onAction={vi.fn()}
      />,
    );

    let row = screen.getByText("Library Query").closest(".nq-tree-row");
    expect(row).not.toBeNull();
    let menuButton = row!.querySelector('button[title="Options"]') as HTMLButtonElement;
    await user.click(menuButton);
    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.getByText("Move…")).toBeInTheDocument();
    expect(screen.getByText("Rename…")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("emits PURGE_QUERY for trash queries", async () => {
    const user = userEvent.setup();
    const trashTree: TreeResponse = {
      view: "trash",
      rootNodes: [
        {
          nodeType: "query",
          id: "trash-q-1",
          name: "Deleted Query",
          folderId: null,
          scope: "MINE",
          queryType: "query_builder",
          deletedAt: "2026-04-10T10:00:00Z",
        },
      ],
    };

    const onAction = vi.fn<(action: SavedQueriesAction) => void>();

    render(
      <SavedQueriesTreeSection
        search=""
        trees={{
          library: emptyTree("library"),
          shared: emptyTree("shared"),
          my: emptyTree("my"),
          trash: trashTree,
        }}
        recent={[]}
        onSelectQuery={() => {}}
        onAction={onAction}
      />,
    );

    const row = screen.getByText("Deleted Query").closest(".nq-tree-row");
    expect(row).not.toBeNull();
    const menuButton = row!.querySelector('button[title="Options"]') as HTMLButtonElement;
    await user.click(menuButton);
    await user.click(screen.getByText("Purge"));

    expect(onAction).toHaveBeenCalledWith({
      type: "PURGE_QUERY",
      queryId: "trash-q-1",
    });
  });
});
