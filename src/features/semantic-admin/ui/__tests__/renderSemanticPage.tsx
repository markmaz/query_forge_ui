import React from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";

import { createAppStore, type RootState } from "../../../../app/providers/store";

type Options = {
  route?: string;
  preloadedState?: Partial<RootState>;
};

export function renderSemanticPage(ui: React.ReactElement, options: Options = {}) {
  const { route = "/semantic/concepts", preloadedState } = options;
  const store = createAppStore(preloadedState);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  const result = render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );

  return { ...result, store, queryClient };
}

