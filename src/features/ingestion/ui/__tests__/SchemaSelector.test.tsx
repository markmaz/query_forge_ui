import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import SchemaSelector from "../components/SchemaSelector";
import { server } from "../../../../qa/msw/server";

const schemasPath = /^https?:\/\/[^/]+(?:\/api\/v1)?\/ingestion\/schemas\/?/;

const makeQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

const renderSelector = (
  props: Partial<Parameters<typeof SchemaSelector>[0]> = {},
) => {
  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <SchemaSelector
        datasource="primary"
        catalog={null}
        value=""
        onChange={vi.fn()}
        {...props}
      />
    </QueryClientProvider>,
  );
};

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());

describe("SchemaSelector", () => {
  it("renders schema options when datasource provided", async () => {
    server.use(
      http.get(schemasPath, () =>
        HttpResponse.json({ schemas: ["asset", "raw"] }),
      ),
    );
    renderSelector();
    expect(await screen.findByText("asset")).toBeInTheDocument();
    expect(screen.getByText("raw")).toBeInTheDocument();
  });

  it("renders loading state", async () => {
    server.use(http.get(schemasPath, () => new Promise(() => {})));
    renderSelector();
    expect(await screen.findByText(/loading schemas/i)).toBeInTheDocument();
  });

  it("renders error fallback with text input", async () => {
    server.use(http.get(schemasPath, () => HttpResponse.error()));
    renderSelector();
    expect(
      await screen.findByText(/could not load schemas/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders text input fallback when schema list is empty", async () => {
    server.use(http.get(schemasPath, () => HttpResponse.json({ schemas: [] })));
    renderSelector();
    expect(await screen.findByText(/no schemas found/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("is disabled with placeholder when no datasource provided", () => {
    const qc = makeQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <SchemaSelector
          datasource=""
          catalog={null}
          value=""
          onChange={vi.fn()}
        />
      </QueryClientProvider>,
    );
    expect(
      screen.getByPlaceholderText(/select a datasource first/i),
    ).toBeDisabled();
  });
});
