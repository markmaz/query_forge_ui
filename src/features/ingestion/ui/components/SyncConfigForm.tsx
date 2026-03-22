import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  FormGroup,
  FormText,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
} from "reactstrap";
import CatalogSchemaSelector from "./CatalogSchemaSelector";
import type { SyncRequest } from "../../../../shared/services/ingestion";
import {
  fetchWorkspaceTables,
  type WorkspaceTableRow,
} from "../../../../shared/services/queryStudioAdminApi";
import { getApiWorkspaceId } from "../../../../shared/services/api";

interface Props {
  onSubmit: (payload: SyncRequest) => void;
  isSubmitting: boolean;
  hasRunningSync: boolean;
}

export default function SyncConfigForm({
  onSubmit,
  isSubmitting,
  hasRunningSync,
}: Props) {
  const [schema, setSchema] = useState("");
  const [catalog, setCatalog] = useState("");
  const [schemaTouched, setSchemaTouched] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [runProfiling, setRunProfiling] = useState(false);
  const [runEnrichment, setRunEnrichment] = useState(false);
  const [overwriteDescriptions, setOverwriteDescriptions] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const selectedSchema = schema.trim();
  const selectedCatalog = catalog.trim() || undefined;
  const workspaceId = getApiWorkspaceId();

  const workspaceTablesQ = useQuery({
    queryKey: [
      "ingestion",
      "workspace-tables",
      workspaceId ?? null,
      selectedCatalog ?? null,
      selectedSchema,
    ],
    enabled: Boolean(workspaceId && selectedSchema),
    queryFn: () =>
      fetchWorkspaceTables({
        workspaceId: workspaceId ?? undefined,
        schema_name: selectedSchema,
        catalog_name: selectedCatalog,
        limit: 2000,
        offset: 0,
      }),
    staleTime: 60_000,
  });

  const workspaceRows = (workspaceTablesQ.data?.rows ??
    []) as WorkspaceTableRow[];

  const schemaTableNames = useMemo(() => {
    if (!schema.trim()) return [] as string[];
    const selectedSchema = schema.trim().toLowerCase();
    const seen = new Set<string>();
    const names: string[] = [];
    workspaceRows.forEach((row) => {
      if (
        String(row.schema_name ?? "")
          .trim()
          .toLowerCase() !== selectedSchema
      )
        return;
      const tableName = String(row.table_name ?? "").trim();
      if (!tableName) return;
      const key = tableName.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      names.push(tableName);
    });
    return names.sort((a, b) => a.localeCompare(b));
  }, [workspaceRows, schema]);

  const filteredTableNames = useMemo(() => {
    const term = tableSearch.trim().toLowerCase();
    if (!term) return schemaTableNames;
    return schemaTableNames.filter((name) => name.toLowerCase().includes(term));
  }, [schemaTableNames, tableSearch]);

  const allVisibleSelected =
    filteredTableNames.length > 0 &&
    filteredTableNames.every((name) => selectedTables.has(name));
  const someVisibleSelected =
    filteredTableNames.some((name) => selectedTables.has(name)) &&
    !allVisibleSelected;

  const schemaError = schemaTouched && schema.trim() === "";

  useEffect(() => {
    setSelectedTables(new Set());
    setTableSearch("");
  }, [schema, workspaceId]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  useEffect(() => {
    setSchema("");
    setCatalog("");
  }, [workspaceId]);

  const buildPayload = (): SyncRequest => {
    const names = Array.from(selectedTables);
    return {
      catalog: catalog.trim() || null,
      schema: schema.trim(),
      table_names: names.length > 0 ? names : null,
      run_profiling: runProfiling,
      run_enrichment: runEnrichment,
      overwrite_descriptions: overwriteDescriptions,
    };
  };

  const handleStartClick = () => {
    setSchemaTouched(true);
    if (schema.trim() === "") return;
    if (hasRunningSync) {
      setShowConfirm(true);
    } else {
      onSubmit(buildPayload());
    }
  };

  const handleConfirm = () => {
    setShowConfirm(false);
    onSubmit(buildPayload());
  };

  return (
    <>
      <FormText className="d-block mb-3 text-muted">
        This sync uses the datasource bound to the currently selected workspace.
      </FormText>

      <CatalogSchemaSelector
        workspaceId={workspaceId}
        catalog={catalog}
        schema={schema}
        onCatalogChange={setCatalog}
        onSchemaChange={(s) => {
          setSchema(s);
          if (s) setSchemaTouched(true);
        }}
        disabled={isSubmitting}
      />
      {schemaError && (
        <div
          id="schema-error"
          className="invalid-feedback d-block"
          role="alert"
        >
          Schema is required.
        </div>
      )}

      <FormGroup>
        <Label for="table-search-input">Table Names (optional)</Label>
        <Input
          id="table-search-input"
          type="text"
          value={tableSearch}
          onChange={(e) => setTableSearch(e.target.value)}
          disabled={isSubmitting || schema.trim() === ""}
          placeholder="Search tables..."
        />
        <FormText>
          Select specific tables below, or leave all unchecked to sync the full
          schema.
        </FormText>
        {schema.trim() !== "" &&
          workspaceTablesQ.isFetching &&
          !workspaceTablesQ.isLoading && (
          <div
            className="d-flex align-items-center gap-2 text-muted small mt-1"
            aria-busy="true"
            aria-live="polite"
          >
            <Spinner size="sm" role="status" aria-label="Loading tables" />
            <span>Loading tables…</span>
          </div>
        )}
        <div
          className="table-responsive border rounded mt-2"
          style={{ maxHeight: 240, overflowY: "auto" }}
        >
          <table className="table table-sm mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th style={{ width: 48 }}>
                  <Input
                    innerRef={selectAllRef}
                    type="checkbox"
                    aria-label="Select all visible tables"
                    checked={allVisibleSelected}
                    disabled={
                      isSubmitting ||
                      filteredTableNames.length === 0 ||
                      schema.trim() === ""
                    }
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSelectedTables((prev) => {
                        const next = new Set(prev);
                        filteredTableNames.forEach((name) => {
                          if (checked) next.add(name);
                          else next.delete(name);
                        });
                        return next;
                      });
                    }}
                  />
                </th>
                <th>Table Name</th>
              </tr>
            </thead>
            <tbody>
              {schema.trim() === "" ? (
                <tr>
                  <td colSpan={2} className="text-muted">
                    Select a schema to view tables.
                  </td>
                </tr>
              ) : workspaceTablesQ.isLoading ? (
                <tr>
                  <td colSpan={2}>
                    <div
                      className="d-flex align-items-center gap-2 text-muted"
                      aria-busy="true"
                      aria-live="polite"
                    >
                      <Spinner
                        size="sm"
                        role="status"
                        aria-label="Loading tables"
                      />
                      <span>Loading tables…</span>
                    </div>
                  </td>
                </tr>
              ) : filteredTableNames.length === 0 ? (
                <tr>
                  <td colSpan={2} className="text-muted">
                    {tableSearch.trim()
                      ? `No tables match "${tableSearch.trim()}".`
                      : "No tables available for this schema."}
                  </td>
                </tr>
              ) : (
                filteredTableNames.map((name) => (
                  <tr key={name}>
                    <td>
                      <Input
                        type="checkbox"
                        aria-label={`Select ${name}`}
                        checked={selectedTables.has(name)}
                        disabled={isSubmitting}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectedTables((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(name);
                            else next.delete(name);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="text-break">{name}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </FormGroup>

      <FormGroup check className="mb-2">
        <Input
          id="run-profiling"
          type="checkbox"
          checked={runProfiling}
          onChange={(e) => setRunProfiling(e.target.checked)}
          disabled={isSubmitting}
        />
        <Label check for="run-profiling">
          Run column profiling
        </Label>
        <FormText className="d-block">
          Samples column values to calculate null rates, distinct counts, and
          top values.
        </FormText>
      </FormGroup>

      <FormGroup check className="mb-3">
        <Input
          id="run-enrichment"
          type="checkbox"
          checked={runEnrichment}
          onChange={(e) => setRunEnrichment(e.target.checked)}
          disabled={isSubmitting}
        />
        <Label check for="run-enrichment">
          Run AI dictionary enrichment
        </Label>
        <FormText className="d-block">
          Uses AI to generate plain-English descriptions for tables and columns.
        </FormText>
      </FormGroup>

      <FormGroup check className="mb-3">
        <Input
          id="overwrite-descriptions"
          type="checkbox"
          checked={overwriteDescriptions}
          onChange={(e) => setOverwriteDescriptions(e.target.checked)}
          disabled={isSubmitting}
        />
        <Label check for="overwrite-descriptions">
          Force overwrite existing descriptions
        </Label>
        <FormText className="d-block">
          Replaces existing table and column descriptions with values from this
          sync.
        </FormText>
      </FormGroup>

      <Button
        color="primary"
        onClick={handleStartClick}
        disabled={isSubmitting}
        aria-disabled={isSubmitting}
      >
        {isSubmitting ? "Syncing\u2026" : "Start Sync"}
      </Button>

      <Modal
        isOpen={showConfirm}
        toggle={() => setShowConfirm(false)}
        aria-labelledby="confirm-modal-title"
      >
        <ModalHeader
          id="confirm-modal-title"
          toggle={() => setShowConfirm(false)}
        >
          Sync Already In Progress
        </ModalHeader>
        <ModalBody>
          A sync is already in progress. Starting a new sync will not cancel the
          current one. Continue?
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setShowConfirm(false)}>
            Cancel
          </Button>
          <Button color="primary" onClick={handleConfirm}>
            Confirm
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
