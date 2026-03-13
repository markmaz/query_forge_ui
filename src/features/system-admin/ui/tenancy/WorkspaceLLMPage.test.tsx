import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { beforeAll, afterAll, afterEach, describe, it, expect } from "vitest";
import WorkspaceLLMPage from "./WorkspaceLLMPage";

const server = setupServer(
  http.get("*/admin/organizations", () =>
    HttpResponse.json({
      rows: [
        {
          organization_id: "org-1",
          name: "Acme Health",
          slug: "acme-health",
          description: null,
          is_active: true,
          created_at: null,
          updated_at: null,
        },
        {
          organization_id: "org-2",
          name: "Northwind",
          slug: "northwind",
          description: null,
          is_active: true,
          created_at: null,
          updated_at: null,
        },
      ],
      total: 2,
      limit: 500,
      offset: 0,
    }),
  ),
  http.get("*/admin/workspaces", ({ request }) => {
    const url = new URL(request.url);
    const orgId = url.searchParams.get("organization_id");
    const rows = [
      {
        workspace_id: "ws1",
        workspace_name: "Acme Workspace",
        organization_id: "org-1",
        organization_name: "Acme Health",
        datasource_id: "ds-1",
        datasource_name: "warehouse",
        datasource_type: "snowflake",
        workspace_is_active: true,
      },
      {
        workspace_id: "ws2",
        workspace_name: "Northwind Workspace",
        organization_id: "org-2",
        organization_name: "Northwind",
        datasource_id: "ds-2",
        datasource_name: "analytics",
        datasource_type: "databricks",
        workspace_is_active: true,
      },
    ];
    const filtered = orgId
      ? rows.filter((row) => row.organization_id === orgId)
      : rows;
    return HttpResponse.json({
      rows: filtered,
      total: filtered.length,
      limit: 5000,
      offset: 0,
    });
  }),
  http.get("*/llm-roles", () =>
    HttpResponse.json([
      { value: "planner", label: "Planner" },
      { value: "ner", label: "Named Entity Recognition" },
    ]),
  ),
  http.get("*/llm-providers", () =>
    HttpResponse.json([
      { value: "openai", label: "OpenAI" },
      { value: "anthropic", label: "Anthropic" },
    ]),
  ),
  http.get("*/workspaces/ws1/llms", () =>
    HttpResponse.json([
      {
        id: 1,
        workspace_id: "ws1",
        name: "GPT-4 Planner",
        provider: "openai",
        model_name: "gpt-4o",
        role: "planner",
        has_api_key: true,
        masked_api_key: "sk-1234...****",
        endpoint_url: null,
        is_active: true,
        config_json: null,
        created_at: "2026-03-11T00:00:00Z",
        updated_at: "2026-03-11T00:00:00Z",
      },
      {
        id: 2,
        workspace_id: "ws1",
        name: "Ollama NER",
        provider: "ollama",
        model_name: "llama3",
        role: "ner",
        has_api_key: false,
        masked_api_key: null,
        endpoint_url: "http://localhost:11434",
        is_active: true,
        config_json: null,
        created_at: "2026-03-11T00:00:00Z",
        updated_at: "2026-03-11T00:00:00Z",
      },
    ]),
  ),
  http.get("*/workspaces/ws2/llms", () => HttpResponse.json([])),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <WorkspaceLLMPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function selectWorkspace(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole("option", { name: "Acme Health" });
  await user.selectOptions(screen.getByLabelText("Organization"), "org-1");
  await screen.findByRole("option", { name: "Acme Workspace" });
  await user.selectOptions(screen.getByLabelText("Workspace"), "ws1");
}

describe("WorkspaceLLMPage", () => {
  it("renders page heading", () => {
    renderPage();
    expect(screen.getByText("Workspace LLM Configuration")).toBeInTheDocument();
  });

  it("shows organization and workspace selectors", () => {
    renderPage();
    expect(screen.getByLabelText("Organization")).toBeInTheDocument();
    expect(screen.getByLabelText("Workspace")).toBeInTheDocument();
  });

  it("shows LLM table after organization and workspace are selected", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectWorkspace(user);
    expect(await screen.findByText("+ Add LLM")).toBeInTheDocument();
    expect(await screen.findByText("GPT-4 Planner")).toBeInTheDocument();
  });

  it("shows em dash for LLM without an API key", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectWorkspace(user);
    await screen.findByText("Ollama NER");
    expect(screen.getByLabelText("No API key")).toBeInTheDocument();
  });

  it("shows inline delete confirmation when Delete is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectWorkspace(user);
    const deleteBtn = await screen.findByLabelText("Delete GPT-4 Planner");
    await user.click(deleteBtn);
    expect(screen.getByText("Confirm delete?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No" })).toBeInTheDocument();
  });
});
