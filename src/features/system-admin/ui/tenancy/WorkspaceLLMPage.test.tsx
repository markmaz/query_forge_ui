import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { beforeAll, afterAll, afterEach, describe, it, expect } from "vitest";
import WorkspaceLLMPage from "./WorkspaceLLMPage";

const server = setupServer(
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
    ]),
  ),
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

describe("WorkspaceLLMPage", () => {
  it("renders page heading", () => {
    renderPage();
    expect(screen.getByText("Workspace LLM Configuration")).toBeInTheDocument();
  });

  it("shows workspace ID input", () => {
    renderPage();
    expect(screen.getByLabelText("Workspace ID")).toBeInTheDocument();
  });

  it("shows LLM table after workspace ID is entered", async () => {
    const user = userEvent.setup();
    renderPage();
    const input = screen.getByLabelText("Workspace ID");
    await user.type(input, "ws1");
    expect(await screen.findByText("+ Add LLM")).toBeInTheDocument();
    expect(await screen.findByText("GPT-4 Planner")).toBeInTheDocument();
  });
});
