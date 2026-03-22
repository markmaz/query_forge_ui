import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DestinationsTab from "../components/DestinationsTab";

vi.mock("@/shared/runtime/accessTokenStore", () => ({
  getAccessToken: () => "token-1",
}));

vi.mock("../components/DestinationForm", () => ({
  default: ({ destination }: { destination?: { name?: string } | null }) => (
    <div>
      Destination form
      {destination?.name ? ` for ${destination.name}` : ""}
    </div>
  ),
}));

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

describe("DestinationsTab", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("updates row status immediately after a successful test", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(
          jsonResponse({
            destinations: [
              {
                id: 7,
                name: "Finance Slack",
                description: "ops",
                destination_type: "slack",
                is_active: true,
                last_test_status: "failed",
                last_test_message: "Old failure",
                last_tested_at: "2026-03-21T10:00:00Z",
                usage: { skills_using_count: 1 },
              },
            ],
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse({
            success: true,
            message: "Slack alert delivered.",
            last_tested_at: "2026-03-22T00:24:30",
          }),
        ),
    );

    render(<DestinationsTab workspaceId="ws-1" isAdmin={true} />);

    expect(await screen.findByText("Failed")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /test destination/i }));

    expect(await screen.findByText("Healthy")).toBeInTheDocument();
    expect(screen.queryByText("Failed")).not.toBeInTheDocument();
    expect(
      await screen.findByText(/Slack alert delivered\./i),
    ).toBeInTheDocument();
  });

  it("opens the edit drawer when an admin clicks a row", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          destinations: [
            {
              id: 8,
              name: "Operations Slack",
              description: "ops",
              destination_type: "slack",
              is_active: true,
              last_test_status: null,
              last_test_message: null,
              last_tested_at: null,
              usage: { skills_using_count: 0 },
            },
          ],
        }),
      ),
    );

    render(<DestinationsTab workspaceId="ws-1" isAdmin={true} />);

    const destinationName = await screen.findByText("Operations Slack");
    const rowButton = destinationName.closest("tr");
    expect(rowButton).not.toBeNull();

    await user.click(rowButton!);

    expect(
      await screen.findByRole("dialog", { name: /edit destination/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Destination form for Operations Slack/i)).toBeInTheDocument();
  });
});
