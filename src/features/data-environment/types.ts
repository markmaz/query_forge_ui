export type LlmState = "stopped" | "starting" | "running" | "stopping" | "error";

export interface LlmStatusResponse {
  state: LlmState;
  publicIp?: string;
  instanceId: string;
  launchTime?: string;
}

