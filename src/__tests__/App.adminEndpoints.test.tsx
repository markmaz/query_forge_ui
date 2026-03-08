import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from ".././RootApp";
import { store } from ".././app/core/store";
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

    render(
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </Provider>
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(requestedUrls.some((url) => isRemovedAdminEndpointPath(url))).toBe(false);
  });
});
