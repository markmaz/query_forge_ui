export type SnowflakeAuthMethod = "password" | "rsa_key" | "externalbrowser";

export type SnowflakeDatasourceFormState = {
  account: string;
  user: string;
  database: string;
  warehouse: string;
  schema: string;
  role: string;
  authenticator: string;
  auth_method: SnowflakeAuthMethod;
  password: string;
  password_configured: boolean;
  private_key_pem: string;
  private_key_pem_configured: boolean;
  private_key_passphrase: string;
  private_key_passphrase_configured: boolean;
  extra_json_text: string;
};

const MASKED_SECRET = "******";
const KNOWN_SNOWFLAKE_KEYS = new Set([
  "account",
  "user",
  "database",
  "warehouse",
  "schema",
  "role",
  "authenticator",
  "auth_method",
  "password",
  "password_encrypted",
  "private_key_pem",
  "private_key_pem_encrypted",
  "private_key_passphrase",
  "private_key_passphrase_encrypted",
]);

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function isMasked(value: unknown): boolean {
  return asString(value).trim() === MASKED_SECRET;
}

export function createSnowflakeDatasourceFormState(
  config: Record<string, unknown> | null | undefined
): SnowflakeDatasourceFormState {
  const record = { ...(config ?? {}) };
  const authMethod = inferSnowflakeAuthMethod(record);
  const extras = Object.entries(record).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (!KNOWN_SNOWFLAKE_KEYS.has(key)) {
      acc[key] = value;
    }
    return acc;
  }, {});

  return {
    account: asString(record.account),
    user: asString(record.user),
    database: asString(record.database),
    warehouse: asString(record.warehouse),
    schema: asString(record.schema),
    role: asString(record.role),
    authenticator: authMethod === "externalbrowser" ? "externalbrowser" : asString(record.authenticator),
    auth_method: authMethod,
    password: "",
    password_configured: isMasked(record.password) || asString(record.password).trim().length > 0,
    private_key_pem: "",
    private_key_pem_configured: isMasked(record.private_key_pem) || asString(record.private_key_pem).trim().length > 0,
    private_key_passphrase: "",
    private_key_passphrase_configured:
      isMasked(record.private_key_passphrase) || asString(record.private_key_passphrase).trim().length > 0,
    extra_json_text: JSON.stringify(extras, null, 2),
  };
}

export function buildSnowflakeDatasourceConfig(
  form: SnowflakeDatasourceFormState,
  parseJson: (text: string) => Record<string, unknown>
): Record<string, unknown> {
  const extra = parseJson(form.extra_json_text || "{}");
  const config: Record<string, unknown> = {
    ...extra,
    account: form.account.trim(),
    user: form.user.trim(),
    database: form.database.trim(),
    auth_method: form.auth_method,
  };

  if (form.warehouse.trim()) config.warehouse = form.warehouse.trim();
  if (form.schema.trim()) config.schema = form.schema.trim();
  if (form.role.trim()) config.role = form.role.trim();

  if (form.auth_method === "externalbrowser") {
    config.authenticator = "externalbrowser";
    return config;
  }

  if (form.authenticator.trim()) {
    config.authenticator = form.authenticator.trim();
  }

  if (form.auth_method === "password") {
    if (form.password.trim()) {
      config.password = form.password;
    } else if (form.password_configured) {
      config.password = MASKED_SECRET;
    }
    return config;
  }

  if (form.private_key_pem.trim()) {
    config.private_key_pem = form.private_key_pem;
  } else if (form.private_key_pem_configured) {
    config.private_key_pem = MASKED_SECRET;
  }

  if (form.private_key_passphrase.trim()) {
    config.private_key_passphrase = form.private_key_passphrase;
  } else if (form.private_key_passphrase_configured) {
    config.private_key_passphrase = MASKED_SECRET;
  }

  return config;
}

function inferSnowflakeAuthMethod(config: Record<string, unknown>): SnowflakeAuthMethod {
  const authMethod = asString(config.auth_method).trim().toLowerCase();
  if (authMethod === "rsa_key") return "rsa_key";
  if (authMethod === "externalbrowser") return "externalbrowser";
  if (authMethod === "password") return "password";

  const authenticator = asString(config.authenticator).trim().toLowerCase();
  if (authenticator === "externalbrowser") return "externalbrowser";

  if (
    isMasked(config.private_key_pem) ||
    asString(config.private_key_pem).trim().length > 0 ||
    asString(config.private_key_pem_encrypted).trim().length > 0
  ) {
    return "rsa_key";
  }
  return "password";
}
