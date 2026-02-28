import React from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";

import { createAppStore, type RootState } from "../../../../app/providers/store";
import { server } from "../../../../test/msw/server";
import MinimalChatPage from "../MinimalChatPage";

function renderChatPage(preloadedState?: Partial<RootState>) {
  const store = createAppStore(preloadedState);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/llm-chat"]}>
          <MinimalChatPage />
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
}

const preloadedState = {
  auth: {
    isAuthenticated: true,
    bootstrapped: true,
  },
  user: {
    user: { user_id: "user-1" },
    rolesByProduct: {},
    capabilities: [],
    loading: false,
    initialized: true,
    error: null,
  },
  userWorkspaces: {
    selectedWorkspaceId: "ws-123",
  },
} as Partial<RootState>;

describe("MinimalChatPage", () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    server.resetHandlers();
    window.localStorage.clear();
  });

  afterAll(() => {
    server.close();
  });

  it("renders empty state", () => {
    renderChatPage(preloadedState);

    expect(screen.getByText(/No messages yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^send$/i })).toBeDisabled();
  });

  it("sends a message and appends assistant response", async () => {
    let seenHeader: string | null = null;

    server.use(
      http.post("*/chat/minimal", async ({ request }) => {
        seenHeader = request.headers.get("x-workspace-id");
        const body = (await request.json()) as Record<string, unknown>;

        expect(body.stream).toBe(false);
        expect(body.temperature).toBe(0.2);
        expect(body.max_tokens).toBe(512);
        expect(body.debug).toBe(false);
        expect(body.messages).toEqual([{ role: "user", content: "Hello Qwen" }]);

        return HttpResponse.json({
          assistant: {
            role: "assistant",
            content: "Hi. This is a test response.",
          },
        });
      })
    );

    const user = userEvent.setup();
    renderChatPage(preloadedState);

    await user.type(screen.getByLabelText(/^message$/i), "Hello Qwen");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByText("Hello Qwen")).toBeInTheDocument();
    expect(await screen.findByText("Hi. This is a test response.")).toBeInTheDocument();
    expect(seenHeader).toBe("ws-123");
  });

  it("shows error state and keeps user message when request fails", async () => {
    server.use(
      http.post("*/chat/minimal", () =>
        HttpResponse.json({ detail: "backend exploded" }, { status: 500 })
      )
    );

    const user = userEvent.setup();
    renderChatPage(preloadedState);

    await user.type(screen.getByLabelText(/^message$/i), "Trigger failure");
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Trigger failure")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(/backend exploded/i);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^send$/i })).toBeDisabled();
    });
  });
});

