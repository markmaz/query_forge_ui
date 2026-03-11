import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useWorkspaceLLMs,
  useCreateWorkspaceLLM,
  useUpdateWorkspaceLLM,
  useDeleteWorkspaceLLM,
  useTestWorkspaceLLM,
  useLLMRoles,
  useLLMProviders,
} from "./useWorkspaceLLM";

const mocks = vi.hoisted(() => ({
  listWorkspaceLLMs: vi.fn(),
  createWorkspaceLLM: vi.fn(),
  listLLMRoles: vi.fn(),
  listLLMProviders: vi.fn(),
  updateWorkspaceLLM: vi.fn(),
  deleteWorkspaceLLM: vi.fn(),
  testWorkspaceLLM: vi.fn(),
}));

vi.mock("../api/workspaceLLMApi", () => ({
  listWorkspaceLLMs: mocks.listWorkspaceLLMs,
  createWorkspaceLLM: mocks.createWorkspaceLLM,
  listLLMRoles: mocks.listLLMRoles,
  listLLMProviders: mocks.listLLMProviders,
  updateWorkspaceLLM: mocks.updateWorkspaceLLM,
  deleteWorkspaceLLM: mocks.deleteWorkspaceLLM,
  testWorkspaceLLM: mocks.testWorkspaceLLM,
}));

const makeWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("useWorkspaceLLMs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is disabled when workspaceId is null", () => {
    const { result } = renderHook(() => useWorkspaceLLMs(null), {
      wrapper: makeWrapper(),
    });

    // A disabled query never leaves its initial state — assert synchronously
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.status).toBe("pending");
    expect(mocks.listWorkspaceLLMs).not.toHaveBeenCalled();
  });

  it("calls listWorkspaceLLMs when workspaceId is provided", async () => {
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
        created_at: "2026-03-11T00:00:00Z",
        updated_at: "2026-03-11T00:00:00Z",
      },
    ];
    mocks.listWorkspaceLLMs.mockResolvedValue(llms);

    const { result } = renderHook(() => useWorkspaceLLMs("ws1"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mocks.listWorkspaceLLMs).toHaveBeenCalledWith("ws1");
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]?.name).toBe("GPT-4 Planner");
  });
});

describe("useCreateWorkspaceLLM", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates the workspace LLM query on success", async () => {
    const created = {
      id: 2,
      workspace_id: "ws1",
      name: "Claude NER",
      provider: "anthropic",
      model_name: "claude-3-sonnet",
      role: "ner",
      has_api_key: false,
      masked_api_key: null,
      endpoint_url: null,
      is_active: true,
      config_json: null,
      created_at: "2026-03-11T00:00:00Z",
      updated_at: "2026-03-11T00:00:00Z",
    };
    mocks.listWorkspaceLLMs.mockResolvedValue([created]);
    mocks.createWorkspaceLLM.mockResolvedValue(created);

    const wrapper = makeWrapper();
    const { result: listResult } = renderHook(() => useWorkspaceLLMs("ws1"), {
      wrapper,
    });
    const { result: createResult } = renderHook(
      () => useCreateWorkspaceLLM("ws1"),
      { wrapper },
    );

    // Wait for list query to settle
    await waitFor(() => {
      expect(listResult.current.isSuccess).toBe(true);
    });

    const callsBefore = mocks.listWorkspaceLLMs.mock.calls.length;

    await act(async () => {
      await createResult.current.mutateAsync({
        name: "Claude NER",
        provider: "anthropic",
        model_name: "claude-3-sonnet",
        role: "ner",
      });
    });

    // After mutation succeeds the workspace query should be invalidated and refetched
    await waitFor(() => {
      expect(mocks.listWorkspaceLLMs.mock.calls.length).toBeGreaterThan(
        callsBefore,
      );
    });
  });
});

describe("useUpdateWorkspaceLLM", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls updateWorkspaceLLM and invalidates the workspace query on success", async () => {
    const updated = {
      id: 1,
      workspace_id: "ws1",
      name: "GPT-4o Planner",
      provider: "openai",
      model_name: "gpt-4o",
      role: "planner",
      has_api_key: true,
      masked_api_key: "sk-****efgh",
      endpoint_url: null,
      is_active: true,
      config_json: null,
      created_at: "2026-03-11T00:00:00Z",
      updated_at: "2026-03-11T12:00:00Z",
    };
    mocks.listWorkspaceLLMs.mockResolvedValue([updated]);
    mocks.updateWorkspaceLLM.mockResolvedValue(updated);

    const wrapper = makeWrapper();
    const { result: listResult } = renderHook(() => useWorkspaceLLMs("ws1"), {
      wrapper,
    });
    const { result: updateResult } = renderHook(
      () => useUpdateWorkspaceLLM("ws1", 1),
      { wrapper },
    );

    await waitFor(() => {
      expect(listResult.current.isSuccess).toBe(true);
    });

    const callsBefore = mocks.listWorkspaceLLMs.mock.calls.length;

    await act(async () => {
      await updateResult.current.mutateAsync({
        name: "GPT-4o Planner",
        model_name: "gpt-4o",
      });
    });

    expect(mocks.updateWorkspaceLLM).toHaveBeenCalledWith("ws1", 1, {
      name: "GPT-4o Planner",
      model_name: "gpt-4o",
    });

    await waitFor(() => {
      expect(mocks.listWorkspaceLLMs.mock.calls.length).toBeGreaterThan(
        callsBefore,
      );
    });
  });
});

describe("useDeleteWorkspaceLLM", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls deleteWorkspaceLLM and invalidates the workspace query on success", async () => {
    mocks.listWorkspaceLLMs.mockResolvedValue([]);
    mocks.deleteWorkspaceLLM.mockResolvedValue(undefined);

    const wrapper = makeWrapper();
    const { result: listResult } = renderHook(() => useWorkspaceLLMs("ws1"), {
      wrapper,
    });
    const { result: deleteResult } = renderHook(
      () => useDeleteWorkspaceLLM("ws1"),
      { wrapper },
    );

    await waitFor(() => {
      expect(listResult.current.isSuccess).toBe(true);
    });

    const callsBefore = mocks.listWorkspaceLLMs.mock.calls.length;

    await act(async () => {
      await deleteResult.current.mutateAsync(1);
    });

    expect(mocks.deleteWorkspaceLLM).toHaveBeenCalledWith("ws1", 1);

    await waitFor(() => {
      expect(mocks.listWorkspaceLLMs.mock.calls.length).toBeGreaterThan(
        callsBefore,
      );
    });
  });
});

describe("useTestWorkspaceLLM", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls testWorkspaceLLM and returns the result", async () => {
    const testResult = { success: true, message: "Connected successfully" };
    mocks.testWorkspaceLLM.mockResolvedValue(testResult);

    const { result } = renderHook(() => useTestWorkspaceLLM("ws1"), {
      wrapper: makeWrapper(),
    });

    let data: typeof testResult | undefined;
    await act(async () => {
      data = await result.current.mutateAsync(1);
    });

    expect(mocks.testWorkspaceLLM).toHaveBeenCalledWith("ws1", 1);
    expect(data).toEqual({ success: true, message: "Connected successfully" });
  });
});

describe("useLLMRoles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns LLM role options", async () => {
    const roles = [
      { value: "planner", label: "Planner" },
      { value: "ner", label: "NER" },
    ];
    mocks.listLLMRoles.mockResolvedValue(roles);

    const { result } = renderHook(() => useLLMRoles(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mocks.listLLMRoles).toHaveBeenCalledTimes(1);
    expect(result.current.data).toHaveLength(2);
  });
});

describe("useLLMProviders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns LLM provider options", async () => {
    const providers = [{ value: "openai", label: "OpenAI" }];
    mocks.listLLMProviders.mockResolvedValue(providers);

    const { result } = renderHook(() => useLLMProviders(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mocks.listLLMProviders).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(providers);
  });
});
