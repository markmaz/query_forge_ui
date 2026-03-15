import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SaveQueryModal } from "./SaveQueryModal";

const tree = {
  view: "my" as const,
  rootNodes: [],
};

describe("SaveQueryModal", () => {
  it("returns attachSkill when option is enabled", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <SaveQueryModal
        open={true}
        myTree={tree}
        myLabel="Mine"
        initialName="Revenue Query"
        initialDescription=""
        showAttachSkillOption={true}
        onClose={() => undefined}
        onSave={onSave}
      />
    );

    await user.click(screen.getByLabelText(/create automation for this query/i));
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Revenue Query",
        attachSkill: true,
      })
    );
  });
});
