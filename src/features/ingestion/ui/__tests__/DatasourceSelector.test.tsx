import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import DatasourceSelector from "../components/DatasourceSelector";
import { server } from "../../../../qa/msw/server";

const DATASOURCES = [
  { name: "primary", type: "databricks" },
  { name: "analytics", type: "snowflake" },
  { name: "broken", type: "unsupported_type" },
];

const datasourcesPath = /^https?:\/\/[^/]+(?:\/api\/v1)?\/datasources\/?$/;

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

const renderWithQuery = (ui: React.ReactElement) => {
  const queryClient = makeQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
};

describe("DatasourceSelector", () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it("renders available datasources as enabled options", async () => {
    server.use(http.get(datasourcesPath, () => HttpResponse.json(DATASOURCES)));

    renderWithQuery(<DatasourceSelector value="" onChange={vi.fn()} />);

    expect(await screen.findByText("primary — databricks")).toBeInTheDocument();
    expect(screen.getByText("analytics — snowflake")).toBeInTheDocument();
    expect(
      screen.getByText("broken — unsupported_type (unavailable)"),
    ).toBeInTheDocument();
  });

  it("renders loading state", async () => {
    // Return a response that never resolves so isLoading stays true
    server.use(http.get(datasourcesPath, () => new Promise<never>(() => {})));

    renderWithQuery(<DatasourceSelector value="" onChange={vi.fn()} />);

    // Spinner text appears immediately while loading
    expect(await screen.findByText(/loading datasources/i)).toBeInTheDocument();
  });

  it("renders error state", async () => {
    server.use(http.get(datasourcesPath, () => HttpResponse.error()));

    renderWithQuery(<DatasourceSelector value="" onChange={vi.fn()} />);

    expect(
      await screen.findByText(/could not load datasources/i),
    ).toBeInTheDocument();
  });

  it("calls onChange with 'primary' as default on load", async () => {
    server.use(http.get(datasourcesPath, () => HttpResponse.json(DATASOURCES)));

    const onChange = vi.fn();
    renderWithQuery(<DatasourceSelector value="" onChange={onChange} />);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("primary");
    });
  });

  it("marks unavailable datasources as disabled", async () => {
    server.use(http.get(datasourcesPath, () => HttpResponse.json(DATASOURCES)));

    renderWithQuery(<DatasourceSelector value="" onChange={vi.fn()} />);

    // Wait for options to appear
    await screen.findByText("primary — databricks");

    const brokenOption = screen.getByText(
      "broken — unsupported_type (unavailable)",
    );
    expect(brokenOption).toBeDisabled();
  });
});
