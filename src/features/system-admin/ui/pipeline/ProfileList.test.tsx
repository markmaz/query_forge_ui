import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfileList from "./ProfileList";

const mocks = vi.hoisted(() => ({
  usePipelineProfiles: vi.fn(),
  usePipelineProfile: vi.fn(),
}));

vi.mock("@/features/system-admin/hooks", () => ({
  usePipelineProfiles: mocks.usePipelineProfiles,
  usePipelineProfile: mocks.usePipelineProfile,
}));

vi.mock("./AggregateStats", () => ({
  default: () => <div data-testid="aggregate-stats">aggregate stats</div>,
}));

vi.mock("./ProfileDetail", () => ({
  default: ({ profile }: { profile: { trace_id: string } }) => (
    <div data-testid="pipeline-profile-detail">{profile.trace_id}</div>
  ),
}));

const PROFILE = {
  trace_id: "trace-12345678",
  workspace_id: "ws-1",
  user_id: "user-1",
  conversation_id: "pdc-1",
  total_ms: 812,
  timestamp: "2026-03-29 10:00:00",
  prompt: "show me the eldest student",
  steps: [{ index: 1, label: "Domain selection", ms: 25 }],
};

describe("ProfileList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.usePipelineProfiles.mockReturnValue({
      data: { profiles: [PROFILE], count: 1 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    mocks.usePipelineProfile.mockImplementation((traceId: string | null) => ({
      data: traceId ? { ...PROFILE, pipeline_trace: { trace_enabled: true } } : undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    }));
  });

  it("opens a drawer with detail data when a row is clicked", async () => {
    const user = userEvent.setup();
    render(<ProfileList />);

    await user.click(screen.getByText(/show me the eldest student/i));

    expect(mocks.usePipelineProfile).toHaveBeenLastCalledWith("trace-12345678");
    expect(screen.getByRole("dialog", { name: /pipeline profile trace-12345678/i })).toBeInTheDocument();
    expect(screen.getByTestId("pipeline-profile-detail")).toHaveTextContent("trace-12345678");

    await user.click(screen.getByRole("button", { name: /close/i }));

    expect(screen.queryByRole("dialog", { name: /pipeline profile trace-12345678/i })).not.toBeInTheDocument();
  });
});
