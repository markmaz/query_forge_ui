import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OverrideList } from "../OverrideList";

describe("OverrideList", () => {
  it("renders override rows and forwards deactivate clicks", async () => {
    const user = userEvent.setup();
    const onDeactivate = vi.fn();

    render(
      <OverrideList
        title="Active Semantic Overrides"
        kind="semantic"
        rows={[
          {
            id: 21,
            status: "active",
            workspace_id: "ws-1",
            concept_key: "student_name",
            domain_key: null,
            override_type: "alias",
            override_key: "phrase_hint",
            override_value_json: { value: "pupil name" },
            approved_by: "admin-1",
          },
        ]}
        onDeactivate={onDeactivate}
      />,
    );

    expect(screen.getByText(/student_name/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /deactivate/i }));
    expect(onDeactivate).toHaveBeenCalledWith(21, "semantic");
  });
});
