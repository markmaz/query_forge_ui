import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import SkillBlockConfigPanel from "../components/SkillBlockConfigPanel";
import { createDefaultAction } from "../constants";

vi.mock("../components/DestinationForm", () => ({
  DestinationPicker: ({
    value,
    onChange,
  }: {
    value: number | null;
    onChange: (value: number | null) => void;
  }) => (
    <div>
      <div data-testid="destination-picker-value">{value == null ? "none" : String(value)}</div>
      <button type="button" onClick={() => onChange(17)}>
        Pick destination
      </button>
    </div>
  ),
}));

describe("SkillBlockConfigPanel", () => {
  it("switches slack delivery to saved destination mode and hides webhook entry", async () => {
    const user = userEvent.setup();
    const onUpdateAction = vi.fn();

    render(
      <SkillBlockConfigPanel
        workspaceId="ws-1"
        selectedTrigger={null}
        selectedCondition={null}
        selectedAction={createDefaultAction("slack_delivery")}
        onUpdateTrigger={vi.fn()}
        onUpdateCondition={vi.fn()}
        onUpdateAction={onUpdateAction}
      />
    );

    expect(screen.getByPlaceholderText("https://hooks.slack.com/services/...")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Saved destination" }));

    expect(onUpdateAction).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ delivery_target_mode: "destination" })
    );
  });

  it("shows saved destination controls when a destination is already attached", () => {
    const selectedAction = createDefaultAction("slack_delivery");
    selectedAction.config = {
      ...selectedAction.config,
      destination_id: 17,
      delivery_target_mode: "destination",
    };

    render(
      <SkillBlockConfigPanel
        workspaceId="ws-1"
        selectedTrigger={null}
        selectedCondition={null}
        selectedAction={selectedAction}
        onUpdateTrigger={vi.fn()}
        onUpdateCondition={vi.fn()}
        onUpdateAction={vi.fn()}
      />
    );

    expect(screen.queryByLabelText(/slack webhook url/i)).not.toBeInTheDocument();
    expect(screen.getByText(/saved destination configuration/i)).toBeInTheDocument();
    expect(screen.getByTestId("destination-picker-value")).toHaveTextContent("17");
  });
});
