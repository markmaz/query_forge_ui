import axios from "axios";

const rawApiUrl = import.meta.env.VITE_API_URL as string | undefined;
const API_URL =
  import.meta.env.DEV && rawApiUrl?.match(/^https?:\/\/localhost:5000\/api\/v1\/?$/i)
    ? "/api/v1"
    : rawApiUrl;

const publicClient = axios.create({
  baseURL: API_URL,
  withCredentials: false,
});

export type FlowForgePublicSignedActionDetails = {
  valid: boolean;
  allowed_actions: string[];
  expires_at?: string | null;
  task: {
    task_type?: string | null;
    status?: string | null;
    source_record_key?: string | null;
  };
};

export type FlowForgePublicSignedActionResult = {
  accepted: boolean;
  action: string;
  runtime?: Record<string, unknown>;
  task: FlowForgePublicSignedActionDetails["task"];
};

export async function getFlowForgePublicSignedActionDetails(token: string) {
  const { data } = await publicClient.get<FlowForgePublicSignedActionDetails>(
    `/flowforge/public/actions/${encodeURIComponent(token)}`,
  );
  return data;
}

export async function completeFlowForgePublicSignedAction({
  token,
  action,
  payload,
}: {
  token: string;
  action: "accept" | "decline";
  payload?: Record<string, unknown>;
}) {
  const { data } = await publicClient.post<FlowForgePublicSignedActionResult>(
    `/flowforge/public/actions/${encodeURIComponent(token)}/${action}`,
    payload ?? {},
  );
  return data;
}
