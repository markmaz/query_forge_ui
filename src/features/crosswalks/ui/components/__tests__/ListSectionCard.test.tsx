import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ListSectionCard, { type ListRow } from ".././ListSectionCard";

const baseRows: ListRow[] = [
  {
    id: "owned-1",
    name: "Owned List",
    createdAt: "2026-02-12",
    updatedAt: "2026-02-12",
    owner: "Owner",
    userId: "user-1",
    isShared: false,
    listType: "regions",
  },
  {
    id: "shared-1",
    name: "Shared List",
    createdAt: "2026-02-12",
    updatedAt: "2026-02-12",
    owner: "Another User",
    userId: "user-2",
    isShared: true,
    listType: "regions",
  },
];

describe("ListSectionCard owner action gating", () => {
  it("disables delete for non-owner rows and enables it for owner rows", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();

    render(
      <ListSectionCard
        section="regions"
        title="Regions"
        rows={baseRows}
        collapsed={false}
        onToggle={() => undefined}
        onGenerateTemplate={() => undefined}
        onUploadClick={() => undefined}
        onPreview={() => undefined}
        onDelete={onDelete}
        currentUserId="user-1"
      />
    );

    const ownedDelete = screen.getByRole("button", { name: /delete owned list/i });
    const sharedDelete = screen.getByRole("button", { name: /delete shared list/i });

    expect(ownedDelete).toBeEnabled();
    expect(sharedDelete).toBeDisabled();

    await user.click(ownedDelete);
    await user.click(sharedDelete);

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: "owned-1" }));
  });
});
