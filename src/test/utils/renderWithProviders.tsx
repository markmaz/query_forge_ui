import React from "react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";

import type { RootState } from "../../app/providers/store";
import { createAppStore } from "../../app/providers/store";
import Layout from "../../app/layout";
import RequireAuth from "../../app/routes/guards/RequireAuth";
import { AppRoutes } from "../../app/routes/AppRoutes";

type RenderOptions = {
  route?: string;
  preloadedState?: Partial<RootState>;
  store?: ReturnType<typeof createAppStore>;
};

export function renderWithProviders(ui: React.ReactElement, options: RenderOptions = {}) {
  const { route = "/", preloadedState, store = createAppStore(preloadedState) } = options;

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
    ...render(
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route element={<RequireAuth />}>
                <Route element={<Layout />}>
                  {AppRoutes.map((r: any) => (
                    <Route key={r.path ?? "index"} path={r.path} element={r.element}>
                      {(r.children ?? []).map((c: any) => (
                        <Route key={c.path ?? "index"} path={c.path} element={c.element} />
                      ))}
                    </Route>
                  ))}
                  <Route path="*" element={ui} />
                </Route>
              </Route>
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </Provider>
    ),
  };
}
