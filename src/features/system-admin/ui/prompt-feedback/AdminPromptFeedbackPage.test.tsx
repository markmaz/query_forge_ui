import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAppStore } from "@/app/core/store";
import AdminPromptFeedbackPage from "./AdminPromptFeedbackPage";

const mocks = vi.hoisted(() => ({
  listPromptFeedback: vi.fn(),
  deletePromptFeedback: vi.fn(),
}));

vi.mock("@/features/system-admin/api", () => ({
  listPromptFeedback: mocks.listPromptFeedback,
  deletePromptFeedback: mocks.deletePromptFeedback,
}));

function renderPage() {
  const store = createAppStore({
    auth: {
      isAuthenticated: true,
      bootstrapped: true,
    },
    user: {
      user: { user_id: "user-1" },
      rolesByProduct: { semantic: ["admin"] },
      capabilities: ["semantic:admin"],
      loading: false,
      initialized: true,
      error: null,
    },
    userWorkspaces: {
      selectedWorkspaceId: "ws-1",
      workspaces: [],
      defaultWorkspace: null,
      loaded: true,
      loading: false,
      error: null,
    },
  } as any);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminPromptFeedbackPage />
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
}

describe("AdminPromptFeedbackPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders rows from response", async () => {
    mocks.listPromptFeedback.mockResolvedValue({
      rows: [
        {
          id: 1,
          vote: "up",
          user_id: "user-a",
          trace_id: "trace-a",
          normalized_prompt: "normalized a",
          prompt_text: "first prompt",
          created_at: "2026-03-06T10:40:52.120Z",
          updated_at: "2026-03-06T10:40:52.120Z",
        },
      ],
      total: 1,
      limit: 25,
      offset: 0,
    });

    renderPage();

    expect(await screen.findByRole("heading", { name: /prompt feedback/i })).toBeInTheDocument();
    expect(await screen.findByText("first prompt")).toBeInTheDocument();
    expect(screen.getByText("trace-a")).toBeInTheDocument();
  });

  it("applies filters and refetches with updated query params", async () => {
    mocks.listPromptFeedback.mockResolvedValue({
      rows: [],
      total: 0,
      limit: 25,
      offset: 0,
    });

    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: /prompt feedback/i });

    await user.selectOptions(screen.getByLabelText(/^vote$/i), "down");
    await user.type(screen.getByLabelText(/^user id$/i), "user-99");
    await user.type(screen.getByLabelText(/^trace id$/i), "trace-99");
    await user.click(screen.getByLabelText(/include payload/i));
    await user.selectOptions(screen.getByLabelText(/^limit$/i), "50");

    await waitFor(() => {
      const lastCall = mocks.listPromptFeedback.mock.calls.at(-1)?.[0] as Record<string, unknown>;
      expect(lastCall?.vote).toBe("down");
      expect(lastCall?.user_id).toBe("user-99");
      expect(lastCall?.trace_id).toBe("trace-99");
      expect(lastCall?.include_payload).toBe(true);
      expect(lastCall?.limit).toBe(50);
      expect(lastCall?.offset).toBe(0);
    });
  });

  it("shows delete confirmation modal", async () => {
    mocks.listPromptFeedback.mockResolvedValue({
      rows: [
        {
          id: 7,
          vote: "up",
          user_id: "user-a",
          trace_id: "trace-a",
          normalized_prompt: "normalized a",
          prompt_text: "prompt seven",
          created_at: null,
          updated_at: null,
        },
      ],
      total: 1,
      limit: 25,
      offset: 0,
    });

    const user = userEvent.setup();
    renderPage();
    await screen.findByText("prompt seven");

    await user.click(screen.getByRole("button", { name: /delete 7/i }));

    const dialog = await screen.findByRole("dialog", { name: /delete prompt feedback/i });
    expect(within(dialog).getByText(/delete prompt feedback record/i)).toBeInTheDocument();
  });

  it("deletes a row and refreshes the list", async () => {
    let rows = [
      {
        id: 1,
        vote: "up",
        user_id: "user-a",
        trace_id: "trace-a",
        normalized_prompt: "normalized a",
        prompt_text: "first prompt",
        created_at: null,
        updated_at: null,
      },
      {
        id: 2,
        vote: "down",
        user_id: "user-b",
        trace_id: "trace-b",
        normalized_prompt: "normalized b",
        prompt_text: "second prompt",
        created_at: null,
        updated_at: null,
      },
    ];
    const deletedIds: number[] = [];

    mocks.listPromptFeedback.mockImplementation(async () => ({
      rows,
      total: rows.length,
      limit: 25,
      offset: 0,
    }));
    mocks.deletePromptFeedback.mockImplementation(async (id: number) => {
      deletedIds.push(id);
      rows = rows.filter((row) => row.id !== id);
      return { deleted: true };
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("first prompt");
    await user.click(screen.getByRole("button", { name: /delete 1/i }));

    const dialog = await screen.findByRole("dialog", { name: /delete prompt feedback/i });
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(deletedIds).toEqual([1]);
    });
    await waitFor(() => {
      expect(mocks.listPromptFeedback.mock.calls.length).toBeGreaterThan(1);
    });
    await waitFor(() => {
      expect(screen.queryByText("first prompt")).not.toBeInTheDocument();
    });
    expect(screen.getByText("second prompt")).toBeInTheDocument();
  });
});
