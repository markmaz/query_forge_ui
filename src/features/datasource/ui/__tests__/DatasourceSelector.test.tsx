import React from "react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";

import { server } from "../../../../qa/msw/server";
import { createAppStore } from "../../../../app/core/store";
import { DatasourceSelector } from "../DatasourceSelector";
import { DEFAULT_DATASOURCE } from "../../model/datasourceSlice";

const makeDatasourceList = () => [
  { name: "primary", type: "databricks" },
  { name: "analytics", type: "snowflake" },
  { name: "legacy", type: "mysql" },
];

function renderSelector(preloadedState?: Parameters<typeof createAppStore>[0]) {
  const store = createAppStore(preloadedState);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const utils = render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <DatasourceSelector />
      </QueryClientProvider>
    </Provider>,
  );
  return { ...utils, store, queryClient };
}

describe("DatasourceSelector", () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "warn" });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it("renders loading state while fetching", async () => {
    // Override with a slow handler so we can catch the loading state
    server.use(
      http.get("*/datasources", async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 200));
        return HttpResponse.json(makeDatasourceList());
      }),
    );

    renderSelector();
    expect(screen.getByRole("status", { name: "Data Source: loading" })).toBeInTheDocument();
    // Wait for completion so the test cleans up properly
    await screen.findByRole("combobox", { name: /data source/i });
  });

  it("renders the list of datasources from the API", async () => {
    server.use(
      http.get("*/datasources", () => HttpResponse.json(makeDatasourceList())),
    );

    renderSelector();

    const select = await screen.findByRole("combobox", {
      name: /data source/i,
    });
    expect(select).toBeInTheDocument();

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent("primary");
    expect(options[1]).toHaveTextContent("analytics");
    expect(options[2]).toHaveTextContent("legacy");
  });

  it("renders error state with message and retry button on fetch failure", async () => {
    server.use(
      http.get("*/datasources", () =>
        HttpResponse.json({ error: "Internal Server Error" }, { status: 500 }),
      ),
    );

    renderSelector();

    const alert = await screen.findByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    // Should not expose internal details — just the HTTP error message or a fallback
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("renders empty state when API returns an empty list", async () => {
    server.use(http.get("*/datasources", () => HttpResponse.json([])));

    renderSelector();

    await screen.findByText(/no datasources configured/i);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("default selection is 'primary'", async () => {
    server.use(
      http.get("*/datasources", () => HttpResponse.json(makeDatasourceList())),
    );

    renderSelector();

    const select = await screen.findByRole("combobox", {
      name: /data source/i,
    });
    expect((select as HTMLSelectElement).value).toBe(DEFAULT_DATASOURCE);
  });

  it("dispatches setSelectedDatasource action when user selects a datasource", async () => {
    server.use(
      http.get("*/datasources", () => HttpResponse.json(makeDatasourceList())),
    );

    const user = userEvent.setup();
    const { store } = renderSelector();

    const select = await screen.findByRole("combobox", {
      name: /data source/i,
    });
    await user.selectOptions(select, "analytics");

    expect(store.getState().datasource.selectedDatasource).toBe("analytics");
  });
});
