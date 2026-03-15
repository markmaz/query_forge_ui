import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SKILL_TEMPLATES } from "../constants";
import SkillBuilderDrawer from "../components/SkillBuilderDrawer";

describe("SkillBuilderDrawer", () => {
  it("creates a draft from template with query context", async () => {
    const user = userEvent.setup();
    const onSaveDraft = vi.fn().mockResolvedValue(undefined);

    render(
      <SkillBuilderDrawer
        open={true}
        mode="create"
        skill={null}
        queryContext={{ queryId: "q1", queryName: "Revenue Query" }}
        queryOptions={[{ id: "q1", name: "Revenue Query" }]}
        templates={SKILL_TEMPLATES}
        runs={[]}
        onClose={() => undefined}
        onSaveDraft={onSaveDraft}
        onSaveSkill={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await user.click(screen.getByRole("button", { name: /daily ai summary/i }));
    await user.clear(screen.getByPlaceholderText(/skill name/i));
    await user.type(screen.getByPlaceholderText(/skill name/i), "Morning Digest");
    await user.click(screen.getByRole("button", { name: /save draft/i }));

    expect(onSaveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Morning Digest",
        queryId: "q1",
      })
    );
  });
});
