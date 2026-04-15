import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { SavedQueriesPanel } from "./SavedQueriesPanel";
import type { RecentItem, TreeResponse } from "../../domain-state/savedQueries";

const emptyTree = (view: TreeResponse["view"]): TreeResponse => ({ view, rootNodes: [] });

function renderPanel(overrides?: Partial<ComponentProps<typeof SavedQueriesPanel>>) {
  const onClose = vi.fn();
  const onChangeSearch = vi.fn();

  const recent: RecentItem[] = [];

  render(
    <SavedQueriesPanel
      open={true}
      search=""
      onChangeSearch={onChangeSearch}
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
  it("renders tree data from tree props", () => {
    renderPanel();

    expect(screen.getByText("Tree Query")).toBeInTheDocument();
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
