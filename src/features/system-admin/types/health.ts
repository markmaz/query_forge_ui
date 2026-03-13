export interface ServiceCheck {
  status: "ok" | "error";
  latency_ms?: number;
  error?: string;
}

export interface VllmCheck extends ServiceCheck {
  model?: string;
  upstream?: Record<string, unknown>;
}

export interface BrokerValkeyCheck {
  address?: string;
  port?: number;
  ping_ok: boolean;
  ping_response?: string | null;
  error?: string | null;
}

export interface BrokerCeleryCheck {
  broker_connect_ok: boolean;
  broker_error?: string | null;
  worker_ping_ok: boolean;
  workers: string[];
  worker_error?: string | null;
}

export interface BrokerCheck {
  status: "ok" | "error";
  ok: boolean;
  broker_url?: string;
  valkey: BrokerValkeyCheck;
  celery: BrokerCeleryCheck;
}

export interface HealthCheck {
  overall: "healthy" | "degraded" | "unhealthy";
  checks: {
    app: ServiceCheck;
    mysql: ServiceCheck;
    vllm: VllmCheck;
    qdrant: ServiceCheck;
    broker?: BrokerCheck;
  };
}

export interface HealthHistoryEntry {
  timestamp: number;
  data: HealthCheck;
}
