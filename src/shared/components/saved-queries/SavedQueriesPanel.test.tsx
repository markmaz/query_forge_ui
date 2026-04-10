import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { SavedQueriesPanel } from "./SavedQueriesPanel";
import type { RecentItem, SavedQueriesData, TreeResponse } from "../../domain-state/savedQueries";

const emptyTree = (view: TreeResponse["view"]): TreeResponse => ({ view, rootNodes: [] });

function renderPanel(overrides?: Partial<ComponentProps<typeof SavedQueriesPanel>>) {
  const onClose = vi.fn();
  const onChangeSearch = vi.fn();

  const data: SavedQueriesData = {
    shared: [{ id: "flat-shared", title: "Flat Shared Query" }],
    mine: [{ id: "flat-mine", title: "Flat Mine Query" }],
    recent: [{ id: "flat-recent", title: "Flat Recent Query" }],
  };

  const recent: RecentItem[] = [];

  render(
    <SavedQueriesPanel
      open={true}
      search=""
      onChangeSearch={onChangeSearch}
      openGroups={{ shared: true, mine: true, recent: true }}
      onToggleGroup={() => undefined}
      data={data}
      onSelectQuery={() => undefined}
      onClose={onClose}
      treeLibrary={emptyTree("library")}
      treeShared={emptyTree("shared")}
      treeMy={{
        view: "my",
        rootNodes: [
          {
            nodeType: "query",
            id: "tree-query-1",
            name: "Tree Query",
            folderId: null,
            scope: "MINE",
            queryType: "query_builder",
          },
        ],
      }}
      treeTrash={emptyTree("trash")}
      recent={recent}
      onAction={() => undefined}
      {...overrides}
    />,
  );

  return { onClose, onChangeSearch };
}

describe("SavedQueriesPanel", () => {
  it("renders tree data instead of stale flat-list data", () => {
    renderPanel();

    expect(screen.getByText("Tree Query")).toBeInTheDocument();
    expect(screen.queryByText("Flat Mine Query")).not.toBeInTheDocument();
    expect(screen.queryByText("Flat Shared Query")).not.toBeInTheDocument();
  });

  it("calls onChangeSearch from the search input", async () => {
    const { onChangeSearch } = renderPanel();

    fireEvent.change(screen.getByPlaceholderText("Search saved queries…"), {
      target: { value: "district" },
    });

    expect(onChangeSearch).toHaveBeenCalledWith("district");
  });

  it("closes on escape when open", async () => {
    const user = userEvent.setup();
    const { onClose } = renderPanel();

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
