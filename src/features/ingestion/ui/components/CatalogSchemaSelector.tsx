import { useEffect, useState } from "react";
import { FormGroup, FormText, Input, Label } from "reactstrap";
import SchemaSelector from "./SchemaSelector";

interface Props {
  datasource: string;
  catalog: string;
  schema: string;
  onCatalogChange: (catalog: string) => void;
  onSchemaChange: (schema: string) => void;
  disabled?: boolean;
}

export default function CatalogSchemaSelector({
  datasource,
  catalog,
  schema,
  onCatalogChange,
  onSchemaChange,
  disabled = false,
}: Props) {
  // committedCatalog drives the schema query — only updates on blur
  // to avoid a new fetch on every keystroke.
  const [committedCatalog, setCommittedCatalog] = useState<string | null>(
    catalog.trim() || null,
  );

  // Sync committedCatalog when catalog prop is reset to empty externally (e.g. datasource change).
  useEffect(() => {
    if (!catalog.trim()) {
      setCommittedCatalog(null);
    }
  }, [catalog]);

  const handleCatalogBlur = () => {
    const next = catalog.trim() || null;
    setCommittedCatalog(next);
    onSchemaChange(""); // reset schema selection when catalog changes
  };

  return (
    <>
      <FormGroup>
        <Label for="catalog-input">
          Catalog <span className="text-muted fw-normal">(optional)</span>
        </Label>
        <Input
          id="catalog-input"
          type="text"
          value={catalog}
          onChange={(e) => onCatalogChange(e.target.value)}
          onBlur={handleCatalogBlur}
          disabled={disabled}
          placeholder="e.g. main"
        />
        <FormText>
          Databricks Unity Catalog name. Leave blank for the default catalog.
        </FormText>
      </FormGroup>
      <SchemaSelector
        datasource={datasource}
        catalog={committedCatalog}
        value={schema}
        onChange={onSchemaChange}
        disabled={disabled}
      />
    </>
  );
}
