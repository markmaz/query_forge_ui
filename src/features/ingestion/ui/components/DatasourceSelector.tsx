import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, FormGroup, Input, Label, Spinner } from "reactstrap";
import { getDatasources } from "../../../../shared/services/ingestion";
import type { Datasource } from "../../../../shared/services/ingestion";

const SUPPORTED_TYPES = new Set(["databricks", "snowflake", "mysql"]);

const isAvailable = (ds: Datasource) => SUPPORTED_TYPES.has(ds.type);

interface Props {
  value: string;
  onChange: (name: string) => void;
  disabled?: boolean;
}

export default function DatasourceSelector({
  value,
  onChange,
  disabled = false,
}: Props) {
  const {
    data: datasources = [],
    isLoading,
    isError,
  } = useQuery<Datasource[], Error>({
    queryKey: ["ingestion", "datasources"],
    queryFn: getDatasources,
    staleTime: 60_000,
  });

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Default selection: "primary" if available, else first datasource
  useEffect(() => {
    if (!value && datasources.length > 0) {
      const primary = datasources.find((d) => d.name === "primary");
      onChangeRef.current(primary?.name ?? datasources[0].name);
    }
  }, [datasources, value]);

  if (isLoading) {
    return (
      <FormGroup>
        <Label>Datasource</Label>
        <div className="d-flex align-items-center gap-2">
          <Spinner size="sm" />
          <span className="text-muted">Loading datasources…</span>
        </div>
      </FormGroup>
    );
  }

  if (isError) {
    return (
      <FormGroup>
        <Label>Datasource</Label>
        <Alert color="danger" role="alert">
          Could not load datasources. Check your connection and refresh the
          page.
        </Alert>
      </FormGroup>
    );
  }

  return (
    <FormGroup>
      <Label for="datasource-select">Datasource</Label>
      <Input
        id="datasource-select"
        type="select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || isLoading}
      >
        {datasources.map((ds) => (
          <option key={ds.name} value={ds.name} disabled={!isAvailable(ds)}>
            {isAvailable(ds)
              ? `${ds.name} — ${ds.type}`
              : `${ds.name} — ${ds.type} (unavailable)`}
          </option>
        ))}
      </Input>
    </FormGroup>
  );
}
