import api from "./api";
import type { LlmStatusResponse } from "../../features/data-environment/types";
const BASE_PATH = "/data-environment/llm";

function isLlmState(value: unknown): value is LlmStatusResponse["state"] {
  return (
    value === "stopped" ||
    value === "starting" ||
    value === "running" ||
    value === "stopping" ||
    value === "error"
  );
}

function parseStatusResponse(data: unknown): LlmStatusResponse {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid LLM status response.");
  }

  const row = data as Record<string, unknown>;
  if (!isLlmState(row.state)) {
    throw new Error("Invalid LLM state in response.");
  }

  if (typeof row.instanceId !== "string") {
    throw new Error("Missing instanceId in LLM status response.");
  }

  return {
    state: row.state,
    instanceId: row.instanceId,
    publicIp: typeof row.publicIp === "string" ? row.publicIp : undefined,
    launchTime: typeof row.launchTime === "string" ? row.launchTime : undefined,
  };
}

export function getStatus(): Promise<LlmStatusResponse> {
  return api
    .get(`${BASE_PATH}/status`)
    .then((response) => parseStatusResponse(response.data));
}

export function startInstance(): Promise<LlmStatusResponse> {
  return api
    .post(`${BASE_PATH}/start`)
    .then((response) => parseStatusResponse(response.data));
}

export function stopInstance(): Promise<LlmStatusResponse> {
  return api
    .post(`${BASE_PATH}/stop`)
    .then((response) => parseStatusResponse(response.data));
}
