import { useQuery } from "@tanstack/react-query";
import { Alert, FormGroup, Input, Label, Spinner } from "reactstrap";
import { getSchemas } from "../../../../shared/services/ingestion";

interface Props {
  workspaceId?: string | null;
  catalog: string | null;
  value: string;
  onChange: (schema: string) => void;
  disabled?: boolean;
}

export default function SchemaSelector({
  workspaceId,
  catalog,
  value,
  onChange,
  disabled = false,
}: Props) {
  const {
    data: schemas,
    isLoading,
    isError,
  } = useQuery<string[], Error>({
    queryKey: ["ingestion", "schemas", workspaceId ?? null, catalog],
    queryFn: () => getSchemas(catalog),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });

  if (!workspaceId) {
    return (
      <FormGroup>
        <Label for="schema-input">Schema</Label>
        <Input
          id="schema-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled
          placeholder="Select a workspace first"
          aria-required="true"
        />
      </FormGroup>
    );
  }

  if (isLoading) {
    return (
      <FormGroup>
        <Label>Schema</Label>
        <div className="d-flex align-items-center gap-2" aria-busy="true">
          <Spinner size="sm" />
          <span className="text-muted">Loading schemas…</span>
        </div>
      </FormGroup>
    );
  }

  if (isError || (schemas !== undefined && schemas.length === 0)) {
    return (
      <FormGroup>
        <Label for="schema-input">Schema</Label>
        {isError && (
          <Alert color="danger" role="alert" className="mb-2 py-2 small">
            Could not load schemas. Enter a schema name manually.
          </Alert>
        )}
        {!isError && schemas !== undefined && schemas.length === 0 && (
          <p className="text-muted small mb-1">No schemas found.</p>
        )}
        <Input
          id="schema-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="e.g. asset"
          aria-required="true"
        />
      </FormGroup>
    );
  }

  return (
    <FormGroup>
      <Label for="schema-select">Schema</Label>
      <Input
        id="schema-select"
        type="select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-required="true"
      >
        <option value="">Select a schema…</option>
        {(schemas ?? []).map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Input>
    </FormGroup>
  );
}
