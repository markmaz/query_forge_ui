export type DatabricksAuthMethod = "token" | "oauth_client_credentials";

export type DatabricksDatasourceFormState = {
  host: string;
  http_path: string;
  catalog: string;
  schema: string;
  auth_method: DatabricksAuthMethod;
  token: string;
  token_configured: boolean;
  client_id: string;
  client_id_configured: boolean;
  client_secret: string;
  client_secret_configured: boolean;
  token_path: string;
  oauth_scope: string;
  extra_json_text: string;
};

const MASKED_SECRET = "******";
const DEFAULT_TOKEN_PATH = "oidc/v1/token";
const DEFAULT_OAUTH_SCOPE = "all-apis";
const KNOWN_DATABRICKS_KEYS = new Set([
  "host",
  "workspace_url",
  "server",
  "http_path",
  "catalog",
  "schema",
  "auth_method",
  "token",
  "token_encrypted",
  "client_id",
  "client_id_encrypted",
  "client_secret",
  "client_secret_encrypted",
  "token_path",
  "token_url",
  "oauth_scope",
]);

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function isMasked(value: unknown): boolean {
  return asString(value).trim() === MASKED_SECRET;
}

export function createDatabricksDatasourceFormState(
  config: Record<string, unknown> | null | undefined
): DatabricksDatasourceFormState {
  const record = { ...(config ?? {}) };
  const authMethod = inferDatabricksAuthMethod(record);
  const extras = Object.entries(record).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (!KNOWN_DATABRICKS_KEYS.has(key)) {
      acc[key] = value;
    }
    return acc;
  }, {});

  return {
    host: asString(record.host || record.workspace_url || record.server),
    http_path: asString(record.http_path),
    catalog: asString(record.catalog),
    schema: asString(record.schema),
    auth_method: authMethod,
    token: "",
    token_configured: isMasked(record.token) || asString(record.token).trim().length > 0,
    client_id: "",
    client_id_configured: isMasked(record.client_id) || asString(record.client_id).trim().length > 0,
    client_secret: "",
    client_secret_configured:
      isMasked(record.client_secret) || asString(record.client_secret).trim().length > 0,
    token_path: asString(record.token_path) || DEFAULT_TOKEN_PATH,
    oauth_scope: asString(record.oauth_scope) || DEFAULT_OAUTH_SCOPE,
    extra_json_text: JSON.stringify(extras, null, 2),
  };
}

export function buildDatabricksDatasourceConfig(
  form: DatabricksDatasourceFormState,
  parseJson: (text: string) => Record<string, unknown>
): Record<string, unknown> {
  const extra = parseJson(form.extra_json_text || "{}");
  const config: Record<string, unknown> = {
    ...extra,
    host: form.host.trim(),
    http_path: form.http_path.trim(),
    auth_method: form.auth_method,
  };

  if (form.catalog.trim()) config.catalog = form.catalog.trim();
  if (form.schema.trim()) config.schema = form.schema.trim();

  if (form.auth_method === "token") {
    if (form.token.trim()) {
      config.token = form.token;
    } else if (form.token_configured) {
      config.token = MASKED_SECRET;
    }
    return config;
  }

  if (form.client_id.trim()) {
    config.client_id = form.client_id;
  } else if (form.client_id_configured) {
    config.client_id = MASKED_SECRET;
  }

  if (form.client_secret.trim()) {
    config.client_secret = form.client_secret;
  } else if (form.client_secret_configured) {
    config.client_secret = MASKED_SECRET;
  }

  if (form.token_path.trim()) {
    config.token_path = form.token_path.trim();
  }
  if (form.oauth_scope.trim()) {
    config.oauth_scope = form.oauth_scope.trim();
  }

  return config;
}

function inferDatabricksAuthMethod(config: Record<string, unknown>): DatabricksAuthMethod {
  const authMethod = asString(config.auth_method).trim().toLowerCase();
  if (authMethod === "oauth_client_credentials") {
    return "oauth_client_credentials";
  }

  if (
    isMasked(config.client_secret) ||
    asString(config.client_secret).trim().length > 0 ||
    asString(config.client_secret_encrypted).trim().length > 0
  ) {
    return "oauth_client_credentials";
  }

  return "token";
}
