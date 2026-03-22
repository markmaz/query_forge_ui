export function getDatasourceConfigSample(type: string): Record<string, unknown> {
  switch ((type || "").trim().toLowerCase()) {
    case "databricks":
      return {
        session_configuration: {
          ansi_mode: "true",
        },
      };
    case "mysql":
      return {
        host: "analytics.example.com",
        port: 3306,
        database: "analytics",
        user: "query_forge",
        password: "<optional if using config_json instead of secret_ref>",
        ssl_ca: "/etc/ssl/certs/server-ca.pem",
      };
    case "postgres":
      return {
        host: "analytics.example.com",
        port: 5432,
        database: "analytics",
        user: "query_forge",
        password: "<optional if using config_json instead of secret_ref>",
        sslmode: "require",
      };
    case "bigquery":
      return {
        project_id: "my-gcp-project",
        dataset: "analytics",
        location: "US",
        credentials_json: "<service-account-json-or-reference>",
      };
    case "snowflake":
      return {
        query_tag: "query_forge",
      };
    default:
      return {};
  }
}

export function getDatasourceConfigSampleText(type: string): string {
  return JSON.stringify(getDatasourceConfigSample(type), null, 2);
}

export function getDatasourceConfigHelpText(type: string): string {
  switch ((type || "").trim().toLowerCase()) {
    case "databricks":
      return "Common Databricks fields are above. Choose Token or OAuth client credentials; this JSON is only for optional extra settings like token_url overrides or session configuration.";
    case "mysql":
      return "Expected keys: host, database, user, password, and ssl_ca. password can come from secret_ref or config_json.";
    case "postgres":
      return "Intended shape shown below. Postgres runtime execution is not wired yet in the backend.";
    case "bigquery":
      return "Intended shape shown below. BigQuery runtime execution is not wired yet in the backend.";
    case "snowflake":
      return "Common Snowflake fields are above. Use this JSON only for optional extra connector settings.";
    default:
      return "Provide a JSON object matching the datasource executor configuration.";
  }
}
