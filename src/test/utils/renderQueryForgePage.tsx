import React from "react";
import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { createAppStore } from "../../app/providers/store";
import type { RootState } from "../../app/providers/store";
import { QueryForgePage } from "../../features/query-forge/ui/QueryForgePage";

type RenderQueryForgePageOptions = {
  route?: string;
  workspaceId?: string;
  preloadedState?: Partial<RootState>;
  store?: ReturnType<typeof createAppStore>;
};

const defaultAuthState = {
  token: "test-access-token",
  isAuthenticated: true,
  authStep: "authenticated" as const,
  challengeId: null,
  challengeExpiresAt: null,
  loading: false,
  bootstrapped: true,
  error: null,
};

export function renderQueryForgePage(options: RenderQueryForgePageOptions = {}) {
  const {
    route = "/no-code/builder/v2",
    workspaceId = "workspace-test-1",
    preloadedState,
    store = createAppStore({
      auth: {
        ...defaultAuthState,
        ...(preloadedState?.auth ?? {}),
      },
      ...(preloadedState ?? {}),
    } as Partial<RootState>),
  } = options;

  window.localStorage.setItem("workspaceId", workspaceId);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });

  return {
    store,
    queryClient,
    ...render(
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path="*" element={<QueryForgePage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </Provider>
    ),
  };
}
