import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import WorkspaceLLMPage from "./WorkspaceLLMPage";

type LlmRow = {
  id: number;
  workspace_id: string;
  name: string;
  provider: string;
  model_name: string;
  role: string;
  has_api_key: boolean;
  masked_api_key: string | null;
  endpoint_url: string | null;
  is_active: boolean;
  config_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

let llmRowsByWorkspace: Record<string, LlmRow[]>;
let nextId: number;

function resetData() {
  llmRowsByWorkspace = {
    ws1: [
      {
        id: 1,
        workspace_id: "ws1",
        name: "Planner Primary",
        provider: "openai",
        model_name: "gpt-4o",
        role: "planner",
        has_api_key: true,
        masked_api_key: "sk-****1111",
        endpoint_url: null,
        is_active: true,
        config_json: null,
        created_at: "2026-03-11T00:00:00Z",
        updated_at: "2026-03-11T00:00:00Z",
      },
      {
        id: 2,
        workspace_id: "ws1",
        name: "NER Backup",
        provider: "anthropic",
        model_name: "claude-sonnet",
        role: "ner",
        has_api_key: false,
        masked_api_key: null,
        endpoint_url: null,
        is_active: false,
        config_json: null,
        created_at: "2026-03-11T00:00:00Z",
        updated_at: "2026-03-11T00:00:00Z",
      },
    ],
    ws2: [],
  };
  nextId = 10;
}

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
      ],
      total: 1,
      limit: 500,
      offset: 0,
    }),
  ),
  http.get("*/admin/workspaces", () =>
    HttpResponse.json({
      rows: [
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
      ],
      total: 1,
      limit: 5000,
      offset: 0,
    }),
  ),
  http.get("*/llm-roles", () =>
    HttpResponse.json([
      { value: "planner", label: "Planner" },
      { value: "summarizer", label: "Summarizer" },
      { value: "ner", label: "NER" },
      { value: "enrichment", label: "Enrichment" },
      { value: "query_generator", label: "Query Generator" },
    ]),
  ),
  http.get("*/llm-providers", () =>
    HttpResponse.json([
      { value: "openai", label: "OpenAI" },
      { value: "anthropic", label: "Anthropic" },
      { value: "azure_openai", label: "Azure OpenAI" },
      { value: "ollama", label: "Ollama" },
      { value: "generic", label: "Generic" },
    ]),
  ),
  http.get("*/workspaces/:workspaceId/llms", ({ params }) => {
    const workspaceId = String(params.workspaceId ?? "");
    return HttpResponse.json(llmRowsByWorkspace[workspaceId] ?? []);
  }),
  http.get("*/workspaces/:workspaceId/llms/:llmId", ({ params }) => {
    const workspaceId = String(params.workspaceId ?? "");
    const llmId = Number(params.llmId ?? 0);
    const row = (llmRowsByWorkspace[workspaceId] ?? []).find((item) => item.id === llmId);
    if (!row) return HttpResponse.json({ error: "Not found" }, { status: 404 });
    return HttpResponse.json(row);
  }),
  http.post("*/workspaces/:workspaceId/llms", async ({ params, request }) => {
    const workspaceId = String(params.workspaceId ?? "");
    const payload = (await request.json()) as Record<string, unknown>;
    const rows = llmRowsByWorkspace[workspaceId] ?? [];

    if (
      payload.is_active === true &&
      typeof payload.role === "string" &&
      rows.some((row) => row.role === payload.role && row.is_active)
    ) {
      return HttpResponse.json(
        { error: "Active role conflict. Role already has an active LLM." },
        { status: 400 },
      );
    }

    const created: LlmRow = {
      id: nextId++,
      workspace_id: workspaceId,
      name: String(payload.name ?? ""),
      provider: String(payload.provider ?? "openai"),
      model_name: String(payload.model_name ?? ""),
      role: String(payload.role ?? "planner"),
      has_api_key: Boolean(payload.api_key),
      masked_api_key: payload.api_key ? "sk-****new" : null,
      endpoint_url:
        typeof payload.endpoint_url === "string" ? payload.endpoint_url : null,
      is_active: payload.is_active !== false,
      config_json:
        payload.config_json && typeof payload.config_json === "object"
          ? (payload.config_json as Record<string, unknown>)
          : null,
      created_at: "2026-03-13T00:00:00Z",
      updated_at: "2026-03-13T00:00:00Z",
    };

    llmRowsByWorkspace[workspaceId] = [...rows, created];
    return HttpResponse.json(created);
  }),
  http.put("*/workspaces/:workspaceId/llms/:llmId", async ({ params, request }) => {
    const workspaceId = String(params.workspaceId ?? "");
    const llmId = Number(params.llmId ?? 0);
    const payload = (await request.json()) as Record<string, unknown>;
    const rows = llmRowsByWorkspace[workspaceId] ?? [];
    const index = rows.findIndex((row) => row.id === llmId);
    if (index < 0) {
      return HttpResponse.json({ error: "Not found" }, { status: 404 });
    }

    const existing = rows[index];
    const nextRole = String(payload.role ?? existing.role);
    const nextActive =
      payload.is_active == null ? existing.is_active : Boolean(payload.is_active);

    if (
      nextActive &&
      rows.some(
        (row) =>
          row.id !== llmId &&
          row.role === nextRole &&
          row.is_active,
      )
    ) {
      return HttpResponse.json(
        { error: "Active role conflict. Role already has an active LLM." },
        { status: 400 },
      );
    }

    const updated: LlmRow = {
      ...existing,
      name: payload.name != null ? String(payload.name) : existing.name,
      provider:
        payload.provider != null ? String(payload.provider) : existing.provider,
      model_name:
        payload.model_name != null
          ? String(payload.model_name)
          : existing.model_name,
      role: nextRole,
      endpoint_url:
        payload.endpoint_url != null
          ? (payload.endpoint_url as string | null)
          : existing.endpoint_url,
      is_active: nextActive,
      has_api_key:
        payload.api_key != null ? Boolean(payload.api_key) : existing.has_api_key,
      masked_api_key:
        payload.api_key != null
          ? (payload.api_key ? "sk-****edit" : null)
          : existing.masked_api_key,
      config_json:
        payload.config_json != null
          ? (payload.config_json as Record<string, unknown> | null)
          : existing.config_json,
      updated_at: "2026-03-13T01:00:00Z",
    };
    llmRowsByWorkspace[workspaceId] = rows.map((row) =>
      row.id === llmId ? updated : row,
    );
    return HttpResponse.json(updated);
  }),
  http.delete("*/workspaces/:workspaceId/llms/:llmId", ({ params }) => {
    const workspaceId = String(params.workspaceId ?? "");
    const llmId = Number(params.llmId ?? 0);
    llmRowsByWorkspace[workspaceId] = (llmRowsByWorkspace[workspaceId] ?? []).filter(
      (row) => row.id !== llmId,
    );
    return HttpResponse.json({ deleted: true });
  }),
  http.post("*/workspaces/:workspaceId/llms/:llmId/test", ({ params }) => {
    const llmId = Number(params.llmId ?? 0);
    const row = Object.values(llmRowsByWorkspace)
      .flat()
      .find((item) => item.id === llmId);
    return HttpResponse.json({
      success: true,
      message: `Connected to ${row?.name ?? "LLM"}`,
      diagnostics: { latency_ms: 42 },
    });
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  resetData();
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
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

async function openCreateEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /\+ add llm/i }));
  await screen.findByRole("dialog", { name: /create llm configuration/i });
}

describe("WorkspaceLLMPage", () => {
  it("renders list for selected workspace", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectWorkspace(user);

    expect(await screen.findByText("Planner Primary")).toBeInTheDocument();
    expect(screen.getByText("NER Backup")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Last Updated" })).toBeInTheDocument();
  });

  it("creates a new llm config", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectWorkspace(user);
    await openCreateEditor(user);

    await user.type(screen.getByLabelText("Name *"), "Summary Worker");
    await user.selectOptions(screen.getByLabelText("Role *"), "summarizer");
    await user.selectOptions(screen.getByLabelText("Provider *"), "openai");
    await user.type(screen.getByLabelText("Model Name *"), "gpt-4.1-mini");
    await user.type(screen.getByLabelText(/api key/i), "sk-test-create");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(await screen.findByText("Summary Worker")).toBeInTheDocument();
  });

  it("hides endpoint for openai and api key for ollama", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectWorkspace(user);
    await openCreateEditor(user);

    expect(screen.queryByLabelText(/endpoint url/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/api key/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Provider *"), "ollama");

    expect(screen.getByLabelText(/endpoint url/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/api key/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/connects to an ollama host\. no api key is needed\./i),
    ).toBeInTheDocument();
  });

  it("requires endpoint for generic providers", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectWorkspace(user);
    await openCreateEditor(user);

    await user.type(screen.getByLabelText("Name *"), "Generic Worker");
    await user.selectOptions(screen.getByLabelText("Role *"), "summarizer");
    await user.selectOptions(screen.getByLabelText("Provider *"), "generic");
    await user.type(screen.getByLabelText("Model Name *"), "local-model");

    expect(screen.getByLabelText(/endpoint url/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^create$/i })).toBeDisabled();

    await user.type(screen.getByLabelText(/endpoint url/i), "https://llm.example.com/v1");
    expect(screen.getByRole("button", { name: /^create$/i })).toBeEnabled();
  });

  it("edits an llm config", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectWorkspace(user);

    await user.click(
      within(screen.getByRole("row", { name: /planner primary/i })).getByRole("button", { name: "Edit" }),
    );
    const dialog = await screen.findByRole("dialog", { name: /edit planner primary/i });
    await user.clear(within(dialog).getByLabelText("Model Name *"));
    await user.type(within(dialog).getByLabelText("Model Name *"), "gpt-4.1");
    await user.click(within(dialog).getByRole("button", { name: /^update$/i }));

    expect(await screen.findByText("gpt-4.1")).toBeInTheDocument();
  });

  it("deletes an llm config", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectWorkspace(user);

    const plannerRow = screen.getByRole("row", { name: /planner primary/i });
    await user.click(within(plannerRow).getByRole("button", { name: "Delete" }));
    await user.click(within(plannerRow).getByRole("button", { name: "Yes" }));

    await waitFor(() => {
      expect(screen.queryByText("Planner Primary")).not.toBeInTheDocument();
    });
  });

  it("renders active role conflict errors inline", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectWorkspace(user);
    await openCreateEditor(user);

    await user.type(screen.getByLabelText("Name *"), "Planner Conflict");
    await user.selectOptions(screen.getByLabelText("Role *"), "planner");
    await user.type(screen.getByLabelText("Model Name *"), "gpt-conflict");
    await user.type(screen.getByLabelText(/api key/i), "sk-test-conflict");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(await screen.findByText(/only one active llm is allowed per role/i)).toBeInTheDocument();
  });

  it("validates config_json text", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectWorkspace(user);
    await openCreateEditor(user);

    await user.type(screen.getByLabelText("Name *"), "Bad JSON Worker");
    await user.type(screen.getByLabelText("Model Name *"), "gpt-bad-json");
    fireEvent.change(screen.getByLabelText(/config_json/i), {
      target: { value: "{broken" },
    });

    expect(await screen.findByText("config_json must be valid JSON.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^create$/i })).toBeDisabled();
  });

  it("shows role usage helper content and highlights from row click", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectWorkspace(user);

    expect(
      screen.getByText(/Used by planning flows \(plan_domain, compact planner, planner_llm, semantic plan\)/i),
    ).toBeInTheDocument();

    const plannerRow = screen.getByRole("row", { name: /planner primary/i });
    await user.click(plannerRow);
    const roleUsageCard = screen
      .getByText("Where this role is used")
      .closest(".sa-card");
    expect(roleUsageCard).toBeTruthy();
    const plannerUsageButton = within(roleUsageCard as HTMLElement)
      .getAllByRole("button")
      .find((button) => within(button).queryByText(/^planner$/i));
    expect(plannerUsageButton).toBeTruthy();
    expect(plannerUsageButton).toHaveClass("active");
  });

  it("runs create -> test -> activate -> edit -> delete workflow", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectWorkspace(user);

    await openCreateEditor(user);
    await user.type(screen.getByLabelText("Name *"), "Generator Draft");
    await user.selectOptions(screen.getByLabelText("Role *"), "query_generator");
    await user.selectOptions(screen.getByLabelText("Provider *"), "openai");
    await user.type(screen.getByLabelText("Model Name *"), "gpt-generator");
    await user.type(screen.getByLabelText(/api key/i), "sk-test-generator");
    await user.click(screen.getByLabelText("Active for selected role"));
    await user.click(screen.getByRole("button", { name: /^create$/i }));
    expect(await screen.findByText("Generator Draft")).toBeInTheDocument();

    let row = screen.getByRole("row", { name: /generator draft/i });
    await user.click(within(row).getByRole("button", { name: "Test" }));
    expect(await screen.findByText(/Connected to Generator Draft/i)).toBeInTheDocument();

    await user.click(within(row).getByRole("button", { name: "Edit" }));
    let dialog = await screen.findByRole("dialog", { name: /edit generator draft/i });
    await user.click(within(dialog).getByLabelText("Active for selected role"));
    await user.click(within(dialog).getByRole("button", { name: /^update$/i }));

    row = await screen.findByRole("row", { name: /generator draft/i });
    expect(within(row).getByText("Active")).toBeInTheDocument();

    await user.click(within(row).getByRole("button", { name: "Edit" }));
    dialog = await screen.findByRole("dialog", { name: /edit generator draft/i });
    await user.clear(within(dialog).getByLabelText("Name *"));
    await user.type(within(dialog).getByLabelText("Name *"), "Generator Final");
    await user.click(within(dialog).getByRole("button", { name: /^update$/i }));
    expect(await screen.findByText("Generator Final")).toBeInTheDocument();

    row = screen.getByRole("row", { name: /generator final/i });
    await user.click(within(row).getByRole("button", { name: "Delete" }));
    await user.click(within(row).getByRole("button", { name: "Yes" }));
    await waitFor(() => {
      expect(screen.queryByText("Generator Final")).not.toBeInTheDocument();
    });
  });
});
