import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import SchemaSelector from "../components/SchemaSelector";
import { server } from "../../../../qa/msw/server";
import { setApiWorkspaceId } from "../../../../shared/services/api";

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
        workspaceId="ws-test-1"
        catalog={null}
        value=""
        onChange={vi.fn()}
        {...props}
      />
    </QueryClientProvider>,
  );
};

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  setApiWorkspaceId(null);
});

describe("SchemaSelector", () => {
  it("renders schema options when workspace provided", async () => {
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

  it("is disabled with placeholder when no workspace provided", () => {
    const qc = makeQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <SchemaSelector
          workspaceId=""
          catalog={null}
          value=""
          onChange={vi.fn()}
        />
      </QueryClientProvider>,
    );
    expect(
      screen.getByPlaceholderText(/select a workspace first/i),
    ).toBeDisabled();
  });
});
