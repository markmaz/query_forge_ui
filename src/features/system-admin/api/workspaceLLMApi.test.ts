import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createWorkspaceLLM,
  deleteWorkspaceLLM,
  getWorkspaceLLM,
  listLLMProviders,
  listLLMRoles,
  listWorkspaceLLMs,
  testWorkspaceLLM,
  updateWorkspaceLLM,
} from "./workspaceLLMApi";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/shared/services/api", () => ({
  default: {
    get: mocks.get,
    post: mocks.post,
    put: mocks.put,
    delete: mocks.delete,
  },
}));

describe("workspaceLLMApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listLLMRoles returns an array of role options", async () => {
    const roleOptions = [
      { value: "planner", label: "Planner" },
      { value: "ner", label: "NER" },
      { value: "summarizer", label: "Summarizer" },
    ];
    mocks.get.mockResolvedValue({ data: roleOptions });

    const result = await listLLMRoles();

    expect(mocks.get).toHaveBeenCalledWith("/llm-roles");
    expect(result).toHaveLength(3);
    expect(result[0]?.value).toBe("planner");
    expect(result[1]?.label).toBe("NER");
  });

  it("listWorkspaceLLMs returns an array of WorkspaceLLM objects", async () => {
    const llms = [
      {
        id: 1,
        workspace_id: "ws1",
        name: "GPT-4 Planner",
        provider: "openai",
        model_name: "gpt-4",
        role: "planner",
        has_api_key: true,
        masked_api_key: "sk-****abcd",
        endpoint_url: null,
        is_active: true,
        config_json: null,
        created_at: "2026-03-01T00:00:00Z",
        updated_at: "2026-03-01T00:00:00Z",
      },
      {
        id: 2,
        workspace_id: "ws1",
        name: "Claude NER",
        provider: "anthropic",
        model_name: "claude-3-sonnet",
        role: "ner",
        has_api_key: false,
        masked_api_key: null,
        endpoint_url: null,
        is_active: false,
        config_json: null,
        created_at: "2026-03-02T00:00:00Z",
        updated_at: "2026-03-02T00:00:00Z",
      },
    ];
    mocks.get.mockResolvedValue({ data: llms });

    const result = await listWorkspaceLLMs("ws1");

    expect(mocks.get).toHaveBeenCalledWith("/workspaces/ws1/llms");
    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe("GPT-4 Planner");
    expect(result[0]?.has_api_key).toBe(true);
    expect(result[1]?.provider).toBe("anthropic");
    expect(result[1]?.has_api_key).toBe(false);
  });

  it("createWorkspaceLLM posts payload and returns the created record", async () => {
    const created = {
      id: 3,
      workspace_id: "ws1",
      name: "Ollama Summarizer",
      provider: "ollama",
      model_name: "llama3",
      role: "summarizer",
      has_api_key: false,
      masked_api_key: null,
      endpoint_url: "http://localhost:11434",
      is_active: true,
      config_json: null,
      created_at: "2026-03-11T00:00:00Z",
      updated_at: "2026-03-11T00:00:00Z",
    };
    mocks.post.mockResolvedValue({ data: created });

    const payload = {
      name: "Ollama Summarizer",
      provider: "ollama" as const,
      model_name: "llama3",
      role: "summarizer" as const,
      endpoint_url: "http://localhost:11434",
      is_active: true,
    };

    const result = await createWorkspaceLLM("ws1", payload);

    expect(mocks.post).toHaveBeenCalledWith("/workspaces/ws1/llms", payload);
    expect(result.id).toBe(3);
    expect(result.name).toBe("Ollama Summarizer");
    expect(result.provider).toBe("ollama");
    expect(result.has_api_key).toBe(false);
  });

  it("deleteWorkspaceLLM calls delete endpoint and resolves without error", async () => {
    mocks.delete.mockResolvedValue({ data: { deleted: true } });

    await expect(deleteWorkspaceLLM("ws1", 1)).resolves.toBeUndefined();

    expect(mocks.delete).toHaveBeenCalledWith("/workspaces/ws1/llms/1");
  });

  it("listLLMProviders returns provider options", async () => {
    mocks.get.mockResolvedValue({
      data: [{ value: "openai", label: "OpenAI" }],
    });

    const result = await listLLMProviders();

    expect(mocks.get).toHaveBeenCalledWith("/llm-providers");
    expect(result).toEqual([{ value: "openai", label: "OpenAI" }]);
  });

  it("updateWorkspaceLLM sends PUT and returns updated record", async () => {
    const updated = {
      id: 1,
      workspace_id: "ws1",
      name: "Updated",
      provider: "openai",
      model_name: "gpt-4o",
      role: "planner",
      has_api_key: false,
      masked_api_key: null,
      endpoint_url: null,
      is_active: true,
      config_json: null,
      created_at: "2026-03-11T00:00:00Z",
      updated_at: "2026-03-11T12:00:00Z",
    };
    mocks.put.mockResolvedValue({ data: updated });

    const result = await updateWorkspaceLLM("ws1", 1, { name: "Updated" });

    expect(mocks.put).toHaveBeenCalledWith("/workspaces/ws1/llms/1", {
      name: "Updated",
    });
    expect(result).toEqual(updated);
  });

  it("getWorkspaceLLM fetches a single llm config", async () => {
    const row = {
      id: 8,
      workspace_id: "ws1",
      name: "Planner 2",
      provider: "openai",
      model_name: "gpt-4.1",
      role: "planner",
      has_api_key: false,
      masked_api_key: null,
      endpoint_url: null,
      is_active: false,
      config_json: null,
      created_at: "2026-03-11T00:00:00Z",
      updated_at: "2026-03-11T00:00:00Z",
    };
    mocks.get.mockResolvedValue({ data: row });

    const result = await getWorkspaceLLM("ws1", 8);

    expect(mocks.get).toHaveBeenCalledWith("/workspaces/ws1/llms/8");
    expect(result).toEqual(row);
  });

  it("testWorkspaceLLM returns success result", async () => {
    mocks.post.mockResolvedValue({
      data: { success: true, message: "Connected" },
    });

    const result = await testWorkspaceLLM("ws1", 1);

    expect(mocks.post).toHaveBeenCalledWith("/workspaces/ws1/llms/1/test", {});
    expect(result).toEqual({ success: true, message: "Connected" });
  });
});
