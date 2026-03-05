export interface ServiceCheck {
  status: "ok" | "error";
  latency_ms?: number;
  error?: string;
}

export interface VllmCheck extends ServiceCheck {
  model?: string;
  upstream?: Record<string, unknown>;
}

export interface HealthCheck {
  overall: "healthy" | "degraded" | "unhealthy";
  checks: {
    app: ServiceCheck;
    mysql: ServiceCheck;
    vllm: VllmCheck;
    qdrant: ServiceCheck;
  };
}

export interface HealthHistoryEntry {
  timestamp: number;
  data: HealthCheck;
}
