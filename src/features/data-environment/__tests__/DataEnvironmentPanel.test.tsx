import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import DataEnvironmentPanel from "../DataEnvironmentPanel";
import { getStatus, startInstance } from "../../../shared/services/dataEnvironmentApi";

vi.mock("../../../shared/services/dataEnvironmentApi", () => ({
  getStatus: vi.fn(),
  startInstance: vi.fn(),
  stopInstance: vi.fn(),
}));

const getStatusMock = vi.mocked(getStatus);
const startInstanceMock = vi.mocked(startInstance);

describe("DataEnvironmentPanel", () => {
  beforeEach(() => {
    vi.useRealTimers();
    getStatusMock.mockReset();
    startInstanceMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders start button when instance is stopped", async () => {
    getStatusMock.mockResolvedValue({
      state: "stopped",
      instanceId: "i-stopped-1",
    });

    render(<DataEnvironmentPanel />);

    expect(await screen.findByRole("button", { name: /^start$/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /^stop$/i })).toBeDisabled();
  });

  it("calls start endpoint when clicking Start", async () => {
    getStatusMock
      .mockResolvedValueOnce({
        state: "stopped",
        instanceId: "i-start-1",
      })
      .mockResolvedValueOnce({
        state: "starting",
        instanceId: "i-start-1",
      });
    startInstanceMock.mockResolvedValue({
      state: "starting",
      instanceId: "i-start-1",
    });

    render(<DataEnvironmentPanel />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /^start$/i }));

    await waitFor(() => {
      expect(startInstanceMock).toHaveBeenCalledTimes(1);
    });
  });

  it("polls status endpoint while in a transition state", async () => {
    vi.useFakeTimers();
    getStatusMock.mockResolvedValue({
      state: "starting",
      instanceId: "i-poll-1",
    });

    render(<DataEnvironmentPanel />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(getStatusMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(getStatusMock).toHaveBeenCalledTimes(2);
  });

  it("keeps status visible but hides start/stop controls when management is disabled", async () => {
    getStatusMock.mockResolvedValue({
      state: "running",
      instanceId: "i-running-1",
      publicIp: "10.0.0.1",
    });

    render(<DataEnvironmentPanel canManageLlm={false} />);

    expect(await screen.findByText(/llm instance/i)).toBeInTheDocument();
    expect(await screen.findByText(/running/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^start$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^stop$/i })).not.toBeInTheDocument();
  });
});
