import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from ".././RootApp";
import { createAppStore } from ".././app/core/store";
import { isRemovedAdminEndpointPath } from ".././shared/services/api";

describe("app startup hardening", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not call removed admin endpoints during app startup", async () => {
    const requestedUrls: string[] = [];
    const originalOpen = XMLHttpRequest.prototype.open;

    vi.spyOn(XMLHttpRequest.prototype, "open").mockImplementation(function (
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null
    ) {
      requestedUrls.push(String(url));
      return originalOpen.call(this, method, url as any, async as any, username as any, password as any);
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
    });
    const store = createAppStore();

    render(
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </Provider>
    );

    await waitFor(() => {
      expect(requestedUrls.some((url) => isRemovedAdminEndpointPath(url))).toBe(false);
    });
  });
});
