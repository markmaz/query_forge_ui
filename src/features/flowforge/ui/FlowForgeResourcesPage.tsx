import { useState } from "react";
import type { ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createFlowForgeResourceSet,
  createManualResourceSnapshot,
  deleteFlowForgeResourceRecord,
  deleteFlowForgeResourceSet,
  listFlowForgeResourceRecords,
  listFlowForgeResourceSets,
  updateFlowForgeResourceRecord,
  updateFlowForgeResourceSet,
} from "../api/adminApi";
import type { FlowForgeResourceRecord, FlowForgeResourceSet } from "../model/adminTypes";
import FlowForgePageHeader from "../components/FlowForgePageHeader";
import StatusBadge from "../components/StatusBadge";
import "./flowforge.css";
import "./flowforgeAdmin.css";

type ResourceRecordDraftEntry = {
  key: string;
  value: string;
  originalValue?: unknown;
};

type ResourceRecordDraft = {
  source_record_key: string;
  display_name: string;
  primary_email: string;
  primary_phone: string;
  status: string;
  effective_status: string;
  availability_status: string;
  capacity_total: string;
  capacity_used: string;
  capacity_available: string;
  current_load: string;
  service_area: string;
  timezone: string;
  source_missing: boolean;
  tags: string;
  validation_status: string;
  attributes: ResourceRecordDraftEntry[];
  normalized_profile: ResourceRecordDraftEntry[];
};

const parseCsvRows = (text: string): string[][] => {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  row.push(current.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
};

const coerceCsvValue = (value: string) => {
  if (value === "") return null;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && value.trim() !== "" ? numericValue : value;
};

const parseUploadedRecords = (fileName: string, text: string) => {
  if (fileName.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { records?: unknown }).records)) {
      return (parsed as { records: unknown[] }).records;
    }
    throw new Error("JSON uploads must be an array of records or an object with a records array.");
  }

  const rows = parseCsvRows(text);
  if (rows.length < 2) throw new Error("CSV uploads must include a header row and at least one record.");
  const headers = rows[0].map((header) => header.trim()).filter(Boolean);
  if (!headers.length) throw new Error("CSV uploads must include at least one column header.");

  return rows.slice(1).map((values, rowIndex) => {
    const record = Object.fromEntries(headers.map((header, index) => [header, coerceCsvValue(values[index] ?? "")]));
    if (!record.source_record_key) record.source_record_key = `uploaded-row-${rowIndex + 1}`;
    return record;
  });
};

const readUploadedFileText = (file: File) => {
  if (typeof file.text === "function") return file.text();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Unable to read uploaded resource file."));
    reader.readAsText(file);
  });
};

const slugifyResourceKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 128);

const createResourceKeySuffix = () => `${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 6)}`;

const buildGeneratedResourceKey = (displayName: string, suffix: string) => `${slugifyResourceKey(displayName) || "resource-pool"}-${suffix}`;

const recordDraftValue = (value: unknown) => {
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const draftEntriesFromObject = (value: Record<string, unknown> | undefined) =>
  Object.entries(value ?? {}).map(([key, entryValue]) => ({
    key,
    value: recordDraftValue(entryValue),
    originalValue: entryValue,
  }));

const createRecordDraft = (record: FlowForgeResourceRecord): ResourceRecordDraft => ({
  source_record_key: record.source_record_key ?? "",
  display_name: record.display_name ?? "",
  primary_email: record.primary_email ?? "",
  primary_phone: record.primary_phone ?? "",
  status: record.status ?? "",
  effective_status: record.effective_status ?? "",
  availability_status: record.availability_status ?? "",
  capacity_total: recordDraftValue(record.capacity_total),
  capacity_used: recordDraftValue(record.capacity_used),
  capacity_available: recordDraftValue(record.capacity_available),
  current_load: recordDraftValue(record.current_load),
  service_area: record.service_area ?? "",
  timezone: record.timezone ?? "",
  source_missing: Boolean(record.source_missing),
  tags: Array.isArray(record.tags) ? record.tags.map((tag) => String(tag)).join(", ") : "",
  validation_status: record.validation_status ?? "",
  attributes: draftEntriesFromObject(record.attributes),
  normalized_profile: draftEntriesFromObject(record.normalized_profile),
});

const stringOrNull = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const numberOrNull = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseDraftEntryValue = (original: unknown, value: string): unknown => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (Array.isArray(original)) return value.split(",").map((entry) => entry.trim()).filter(Boolean);
  if (typeof original === "boolean") return trimmed.toLowerCase() === "true";
  if (typeof original === "number") {
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : original;
  }
  if (typeof original === "object" && original !== null) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  if (trimmed.toLowerCase() === "true") return true;
  if (trimmed.toLowerCase() === "false") return false;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && /^-?\d+(\.\d+)?$/.test(trimmed) ? parsed : value;
};

const draftEntriesToObject = (entries: ResourceRecordDraftEntry[]) =>
  Object.fromEntries(
    entries
      .map((entry) => [entry.key.trim(), parseDraftEntryValue(entry.originalValue, entry.value)] as const)
      .filter(([key]) => key.length > 0),
  );

const buildRecordPayload = (draft: ResourceRecordDraft): Record<string, unknown> => ({
  source_record_key: draft.source_record_key.trim(),
  display_name: stringOrNull(draft.display_name),
  primary_email: stringOrNull(draft.primary_email),
  primary_phone: stringOrNull(draft.primary_phone),
  status: stringOrNull(draft.status),
  effective_status: stringOrNull(draft.effective_status),
  availability_status: stringOrNull(draft.availability_status),
  capacity_total: numberOrNull(draft.capacity_total),
  capacity_used: numberOrNull(draft.capacity_used),
  capacity_available: numberOrNull(draft.capacity_available),
  current_load: numberOrNull(draft.current_load),
  service_area: stringOrNull(draft.service_area),
  timezone: stringOrNull(draft.timezone),
  source_missing: draft.source_missing,
  tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
  validation_status: stringOrNull(draft.validation_status),
  attributes: draftEntriesToObject(draft.attributes),
  normalized_profile: draftEntriesToObject(draft.normalized_profile),
});

const RESOURCE_EXPORT_STANDARD_FIELDS: Array<keyof FlowForgeResourceRecord> = [
  "source_record_key",
  "display_name",
  "primary_email",
  "primary_phone",
  "status",
  "effective_status",
  "availability_status",
  "capacity_total",
  "capacity_used",
  "capacity_available",
  "current_load",
  "service_area",
  "timezone",
  "source_missing",
  "validation_status",
];

const csvCell = (value: unknown) => {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join(", ") : typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const buildResourceExportCsv = (records: FlowForgeResourceRecord[]) => {
  const normalizedKeys = Array.from(new Set(records.flatMap((record) => Object.keys(record.normalized_profile ?? {})))).sort();
  const attributeKeys = Array.from(new Set(records.flatMap((record) => Object.keys(record.attributes ?? {})))).sort();
  const headers = [
    ...RESOURCE_EXPORT_STANDARD_FIELDS,
    "tags",
    ...normalizedKeys.map((key) => `normalized_profile.${key}`),
    ...attributeKeys.map((key) => `attributes.${key}`),
  ];
  const rows = records.map((record) =>
    headers.map((header) => {
      if (header === "tags") return csvCell(record.tags ?? []);
      if (header.startsWith("normalized_profile.")) return csvCell(record.normalized_profile?.[header.replace("normalized_profile.", "")]);
      if (header.startsWith("attributes.")) return csvCell(record.attributes?.[header.replace("attributes.", "")]);
      return csvCell(record[header as keyof FlowForgeResourceRecord]);
    }),
  );
  return [headers.map(csvCell), ...rows].map((row) => row.join(",")).join("\n");
};

const downloadCsv = (fileName: string, csv: string) => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

function ResourceSetCardMenu({
  deletePending,
  exportPending,
  togglePending,
  resourceSet,
  onDelete,
  onExport,
  onOpen,
  onToggleEnabled,
}: {
  deletePending: boolean;
  exportPending: boolean;
  togglePending: boolean;
  resourceSet: FlowForgeResourceSet;
  onDelete: () => void;
  onExport: () => void;
  onOpen: () => void;
  onToggleEnabled: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ff-workflow-card-menu">
      <button
        type="button"
        className="ff-workflow-card-menu-button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        title="Resource set options"
        aria-label="Resource set options"
      >
        <i className="fa fa-ellipsis-v" aria-hidden="true" />
      </button>
      {open ? (
        <div className="ff-workflow-menu-popover" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpen();
            }}
          >
            Open resource set
          </button>
          <button
            type="button"
            disabled={exportPending || !resourceSet.active_snapshot_batch_id}
            onClick={() => {
              setOpen(false);
              onExport();
            }}
          >
            Export resource pool
          </button>
          <button
            type="button"
            disabled={togglePending}
            onClick={() => {
              setOpen(false);
              onToggleEnabled();
            }}
          >
            {resourceSet.enabled ? "Disable resource set" : "Enable resource set"}
          </button>
          <div className="ff-workflow-menu-divider" />
          <button
            type="button"
            disabled={deletePending}
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            Delete resource set
          </button>
        </div>
      ) : null}
      {open ? <div className="ff-workflow-menu-backdrop" onClick={() => setOpen(false)} /> : null}
    </div>
  );
}

function ResourceRecordCustomFields({
  entries,
  label,
  section,
  onAdd,
  onChange,
  onRemove,
}: {
  entries: ResourceRecordDraftEntry[];
  label: string;
  section: "attributes" | "normalized_profile";
  onAdd: (section: "attributes" | "normalized_profile") => void;
  onChange: (section: "attributes" | "normalized_profile", index: number, field: "key" | "value", value: string) => void;
  onRemove: (section: "attributes" | "normalized_profile", index: number) => void;
}) {
  return (
    <section className="ff-resource-record-form-section">
      <div className="ff-resource-record-form-section-header">
        <h4>{label}</h4>
        <button type="button" className="btn btn-outline-secondary" onClick={() => onAdd(section)} aria-label={`Add ${label} field`}>
          Add Field
        </button>
      </div>
      <div className="ff-resource-record-field-table">
        {entries.map((entry, index) => (
          <div className="ff-resource-record-field-row" key={`${section}-${index}`}>
            <label>
              Field
              <input
                type="text"
                value={entry.key}
                onChange={(event) => onChange(section, index, "key", event.target.value)}
                aria-label={`${label} Key ${index + 1}`}
              />
            </label>
            <label>
              Value
              <input
                type="text"
                value={entry.value}
                onChange={(event) => onChange(section, index, "value", event.target.value)}
                aria-label={`${label} Value ${index + 1}`}
              />
            </label>
            <button
              type="button"
              className="btn btn-outline-danger ff-resource-record-icon-button"
              onClick={() => onRemove(section, index)}
              aria-label={`Remove ${label} field ${index + 1}`}
              title="Remove field"
            >
              <i className="fa fa-trash" aria-hidden="true" />
            </button>
          </div>
        ))}
        {!entries.length ? <div className="ff-empty-state">No fields yet.</div> : null}
      </div>
    </section>
  );
}

export default function FlowForgeResourcesPage() {
  const queryClient = useQueryClient();
  const [resourceKey, setResourceKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [resourceKeyTouched, setResourceKeyTouched] = useState(false);
  const [resourceKeySuffix, setResourceKeySuffix] = useState(createResourceKeySuffix);
  const [selectedResourceSetId, setSelectedResourceSetId] = useState<number | null>(null);
  const [isCreatingNewResourceSet, setIsCreatingNewResourceSet] = useState(false);
  const [savedResourcesOpen, setSavedResourcesOpen] = useState(true);
  const [recordsJson, setRecordsJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploadSummary, setUploadSummary] = useState<string | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
  const [recordDraft, setRecordDraft] = useState<ResourceRecordDraft | null>(null);
  const [recordEditError, setRecordEditError] = useState<string | null>(null);
  const [exportingResourceSetId, setExportingResourceSetId] = useState<number | null>(null);

  const resourceSetsQuery = useQuery({
    queryKey: ["flowforge", "admin", "resource-sets"],
    queryFn: listFlowForgeResourceSets,
  });
  const resourceSets = resourceSetsQuery.data ?? [];
  const activeResourceSetId = isCreatingNewResourceSet ? null : selectedResourceSetId;
  const activeResourceSet = resourceSets.find((set) => set.id === activeResourceSetId) ?? null;
  const hasResourceBuilderOpen = isCreatingNewResourceSet || Boolean(activeResourceSetId);
  const canCreateResourceSet = resourceKey.trim().length > 0 && displayName.trim().length > 0;
  const canActivateRecords = Boolean(activeResourceSetId) && recordsJson.trim().length > 0;
  const recordsQuery = useQuery({
    queryKey: ["flowforge", "admin", "resource-records", activeResourceSetId],
    queryFn: () => listFlowForgeResourceRecords(activeResourceSetId as number),
    enabled: Boolean(activeResourceSetId),
  });
  const activeRecord = (recordsQuery.data?.records ?? []).find((record) => record.id === editingRecordId) ?? null;
  const createSetMutation = useMutation({
    mutationFn: () =>
      createFlowForgeResourceSet({
        resource_set_key: resourceKey.trim(),
        display_name: displayName.trim(),
        source_type: "manual_csv",
      }),
    onError: (mutationError) => setError(mutationError instanceof Error ? mutationError.message : "Unable to create resource set."),
    onSuccess: async (created) => {
      setSelectedResourceSetId(created.id);
      setIsCreatingNewResourceSet(false);
      setResourceKeyTouched(false);
      setRecordsJson("");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["flowforge", "admin", "resource-sets"] });
    },
  });
  const updateSetMutation = useMutation({
    mutationFn: ({ resourceSetId, enabled }: { resourceSetId: number; enabled: boolean }) => updateFlowForgeResourceSet(resourceSetId, { enabled }),
    onError: (mutationError) => setError(mutationError instanceof Error ? mutationError.message : "Unable to update resource set."),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["flowforge", "admin", "resource-sets"] });
    },
  });
  const deleteSetMutation = useMutation({
    mutationFn: (resourceSetId: number) => deleteFlowForgeResourceSet(resourceSetId),
    onError: (mutationError) => setError(mutationError instanceof Error ? mutationError.message : "Unable to delete resource set."),
    onSuccess: async (deleted) => {
      if (deleted.resource_set_id === activeResourceSetId) {
        setSelectedResourceSetId(null);
        setResourceKey("");
        setDisplayName("");
        setRecordsJson("");
        setUploadSummary(null);
        setEditingRecordId(null);
        setRecordDraft(null);
      }
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["flowforge", "admin", "resource-sets"] });
      await queryClient.invalidateQueries({ queryKey: ["flowforge", "admin", "resource-records"] });
    },
  });
  const snapshotMutation = useMutation({
    mutationFn: () => {
      if (!recordsJson.trim()) throw new Error("Review records are required before activation.");
      const records = JSON.parse(recordsJson);
      if (!Array.isArray(records)) throw new Error("Records JSON must be an array.");
      return createManualResourceSnapshot(activeResourceSetId as number, { mode: "test", activate: true, records });
    },
    onError: (mutationError) => setError(mutationError instanceof Error ? mutationError.message : "Unable to activate records."),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["flowforge", "admin", "resource-records", activeResourceSetId] });
    },
  });
  const updateRecordMutation = useMutation({
    mutationFn: ({ recordId, payload }: { recordId: number; payload: Record<string, unknown> }) =>
      updateFlowForgeResourceRecord(activeResourceSetId as number, recordId, payload),
    onError: (mutationError) => setRecordEditError(mutationError instanceof Error ? mutationError.message : "Unable to update resource record."),
    onSuccess: async (updatedRecord) => {
      setRecordEditError(null);
      setRecordDraft(createRecordDraft(updatedRecord));
      await queryClient.invalidateQueries({ queryKey: ["flowforge", "admin", "resource-records", activeResourceSetId] });
    },
  });
  const deleteRecordMutation = useMutation({
    mutationFn: (recordId: number) => deleteFlowForgeResourceRecord(activeResourceSetId as number, recordId),
    onError: (mutationError) => setRecordEditError(mutationError instanceof Error ? mutationError.message : "Unable to delete resource record."),
    onSuccess: async (deleted) => {
      if (deleted.resource_record_id === editingRecordId) {
        setEditingRecordId(null);
        setRecordDraft(null);
      }
      setRecordEditError(null);
      await queryClient.invalidateQueries({ queryKey: ["flowforge", "admin", "resource-records", activeResourceSetId] });
    },
  });

  const handleResourceUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const records = parseUploadedRecords(file.name, await readUploadedFileText(file));
      setRecordsJson(JSON.stringify(records, null, 2));
      setUploadSummary(`Loaded ${records.length} ${records.length === 1 ? "record" : "records"} from ${file.name}.`);
      setError(null);
    } catch (uploadError) {
      setUploadSummary(null);
      setError(uploadError instanceof Error ? uploadError.message : "Unable to read uploaded resource file.");
    } finally {
      event.target.value = "";
    }
  };

  const startNewResourceSet = () => {
    const nextSuffix = createResourceKeySuffix();
    setIsCreatingNewResourceSet(true);
    setSelectedResourceSetId(null);
    setResourceKeySuffix(nextSuffix);
    setResourceKey(buildGeneratedResourceKey("", nextSuffix));
    setDisplayName("");
    setResourceKeyTouched(false);
    setRecordsJson("");
    setUploadSummary(null);
    setEditingRecordId(null);
    setRecordDraft(null);
    setRecordEditError(null);
    setError(null);
    createSetMutation.reset();
    snapshotMutation.reset();
  };

  const selectResourceSet = (resourceSet: { id: number; resource_set_key: string; display_name: string }) => {
    setIsCreatingNewResourceSet(false);
    setSelectedResourceSetId(resourceSet.id);
    setResourceKey(resourceSet.resource_set_key);
    setDisplayName(resourceSet.display_name);
    setResourceKeyTouched(false);
    setResourceKeySuffix(createResourceKeySuffix());
    setUploadSummary(null);
    setRecordsJson("");
    setEditingRecordId(null);
    setRecordDraft(null);
    setRecordEditError(null);
    setError(null);
    snapshotMutation.reset();
  };

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    if (isCreatingNewResourceSet && !resourceKeyTouched) {
      setResourceKey(buildGeneratedResourceKey(value, resourceKeySuffix));
    }
  };

  const startEditingRecord = (record: FlowForgeResourceRecord) => {
    setEditingRecordId(record.id);
    setRecordDraft(createRecordDraft(record));
    setRecordEditError(null);
    updateRecordMutation.reset();
  };

  const saveRecordDraft = () => {
    if (!activeRecord || !recordDraft) return;
    if (!recordDraft.source_record_key.trim()) {
      setRecordEditError("Record key is required.");
      return;
    }
    updateRecordMutation.mutate({ recordId: activeRecord.id, payload: buildRecordPayload(recordDraft) });
  };

  const closeRecordDrawer = () => {
    setEditingRecordId(null);
    setRecordDraft(null);
    setRecordEditError(null);
  };

  const updateRecordDraftField = <Field extends keyof ResourceRecordDraft>(field: Field, value: ResourceRecordDraft[Field]) => {
    setRecordDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  const updateRecordDraftEntry = (
    section: "attributes" | "normalized_profile",
    index: number,
    field: "key" | "value",
    value: string,
  ) => {
    setRecordDraft((current) => {
      if (!current) return current;
      const entries = current[section].map((entry, entryIndex) => (entryIndex === index ? { ...entry, [field]: value } : entry));
      return { ...current, [section]: entries };
    });
  };

  const addRecordDraftEntry = (section: "attributes" | "normalized_profile") => {
    setRecordDraft((current) => (current ? { ...current, [section]: [...current[section], { key: "", value: "" }] } : current));
  };

  const removeRecordDraftEntry = (section: "attributes" | "normalized_profile", index: number) => {
    setRecordDraft((current) => {
      if (!current) return current;
      return { ...current, [section]: current[section].filter((_, entryIndex) => entryIndex !== index) };
    });
  };

  const exportResourceSet = async (resourceSet: FlowForgeResourceSet) => {
    setExportingResourceSetId(resourceSet.id);
    try {
      const records: FlowForgeResourceRecord[] = [];
      const limit = 500;
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const response = await listFlowForgeResourceRecords(resourceSet.id, { limit, offset });
        records.push(...response.records);
        hasMore = response.records.length === limit;
        offset += limit;
      }
      const csv = buildResourceExportCsv(records);
      downloadCsv(`${resourceSet.resource_set_key || "resource-pool"}-export.csv`, csv);
      setError(null);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Unable to export resource pool.");
    } finally {
      setExportingResourceSetId(null);
    }
  };

  return (
    <main className="ff-page">
      <FlowForgePageHeader
        title="Resource Sets"
        description="Build the resource pools that matching policies can search, score, and assign."
      />
      <section
        className={`ff-resource-studio ${savedResourcesOpen ? "is-saved-open" : "is-saved-collapsed"}`}
        aria-label="Resource set studio"
      >
        <div className={`ff-resource-left-cluster ${savedResourcesOpen ? "is-open" : "is-collapsed"}`}>
          <aside className="ncqv2-builder-rail ff-policy-saved-rail ff-resource-saved-rail" aria-label="Resource set tools">
            <div className="ncqv2-rail-top">
              <button type="button" className="btn btn-primary" onClick={startNewResourceSet} aria-label="Create New Resource Set" title="New Resource Set">
                <i className="fa fa-plus" aria-hidden="true" />
              </button>
              <button
                type="button"
                className={`btn ${savedResourcesOpen ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => setSavedResourcesOpen((current) => !current)}
                aria-label="Saved Resource Sets"
                aria-expanded={savedResourcesOpen}
                title={savedResourcesOpen ? "Hide Saved Resource Sets" : "Show Saved Resource Sets"}
              >
                <i className="fa fa-folder-open" aria-hidden="true" />
              </button>
            </div>
            <div className="ncqv2-rail-divider" />
            <button type="button" className="btn btn-outline-secondary" aria-label="Active Records" title="Active Records" disabled={!activeResourceSetId}>
              <i className="fa fa-table-list" aria-hidden="true" />
            </button>
          </aside>

          <aside className="ff-resource-saved-panel" aria-label="Saved resource sets" aria-hidden={!savedResourcesOpen}>
            <section className="ff-policy-sidebar-section" aria-labelledby="ff-resource-sets-heading">
              <div className="ff-policy-panel-header">
                <div>
                  <h2 id="ff-resource-sets-heading">Saved Resource Sets</h2>
                  <p className="ff-admin-helper">Open a pool, create a new one, or review its active records.</p>
                </div>
              </div>
              <details className="ff-policy-help-box">
                <summary>How resource sets work</summary>
                <div className="ff-policy-help-steps" aria-label="Resource set setup steps">
                  <article>
                    <span>1</span>
                    <strong>Choose or create a pool</strong>
                    <p>Resource sets are the people or assets a workflow can route to.</p>
                  </article>
                  <article>
                    <span>2</span>
                    <strong>Load resource records</strong>
                    <p>Activate test records now; imports and mapped sources can feed the same pool later.</p>
                  </article>
                  <article>
                    <span>3</span>
                    <strong>Review what matching sees</strong>
                    <p>Confirm names, contact details, status, and capacity before using a policy.</p>
                  </article>
                </div>
              </details>
              <div className="ff-admin-list">
                {isCreatingNewResourceSet ? (
                  <div className="ff-policy-new-state">
                    <strong>New resource set draft</strong>
                    <p>Name the pool, create it, then activate the records matching policies should use.</p>
                  </div>
                ) : null}
                {resourceSets.map((set) => (
                  <article key={set.id} className={`ff-admin-card ff-resource-card ${set.id === activeResourceSetId ? "is-active" : ""}`}>
                    <button type="button" className="ff-policy-card-main" onClick={() => selectResourceSet(set)} aria-label={`Open ${set.display_name}`}>
                      <div>
                        <span className="ff-policy-card-title">{set.display_name}</span>
                        <span className="ff-policy-card-meta">
                          {set.resource_set_key} · {set.source_type}
                        </span>
                      </div>
                    </button>
                    <ResourceSetCardMenu
                      deletePending={deleteSetMutation.isPending}
                      exportPending={exportingResourceSetId === set.id}
                      togglePending={updateSetMutation.isPending}
                      resourceSet={set}
                      onDelete={() => deleteSetMutation.mutate(set.id)}
                      onExport={() => void exportResourceSet(set)}
                      onOpen={() => selectResourceSet(set)}
                      onToggleEnabled={() => updateSetMutation.mutate({ resourceSetId: set.id, enabled: !set.enabled })}
                    />
                    <div className="ff-resource-card-footer">
                      <span>{set.active_snapshot_batch_id ? `Active batch ${set.active_snapshot_batch_id}` : "No active records"}</span>
                      <StatusBadge status={set.enabled ? "enabled" : "disabled"} />
                    </div>
                  </article>
                ))}
                {!resourceSets.length ? <div className="ff-empty-state">No resource sets yet. Create the first pool to continue.</div> : null}
              </div>
            </section>
          </aside>
        </div>

        <main className="ff-resource-workspace" aria-label="Resource set builder">
          {hasResourceBuilderOpen ? (
            <section className="ff-runtime-panel">
              <div className="ff-policy-panel-header">
                <div>
                  <h2>{isCreatingNewResourceSet ? "Build a New Resource Set" : "Build Resource Set"}</h2>
                  <p className="ff-admin-helper">
                    {activeResourceSet
                      ? `Load and activate records for ${activeResourceSet.display_name}.`
                      : "Name the resource pool that operators and policies will use."}
                  </p>
                </div>
              </div>
              <form
                className="ff-admin-form ff-resource-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (isCreatingNewResourceSet) {
                    createSetMutation.mutate();
                    return;
                  }
                  snapshotMutation.mutate();
                }}
              >
                <div className="ff-resource-builder-grid">
                  <label>
                    Display Name
                    <input value={displayName} onChange={(event) => handleDisplayNameChange(event.target.value)} disabled={!isCreatingNewResourceSet} required />
                  </label>
                  <label>
                    Resource Key
                    <input
                      value={resourceKey}
                      onChange={(event) => {
                        setResourceKeyTouched(true);
                        setResourceKey(slugifyResourceKey(event.target.value));
                      }}
                      disabled={!isCreatingNewResourceSet}
                      required
                    />
                  </label>
                </div>
                {isCreatingNewResourceSet ? (
                  <button type="submit" className="btn btn-primary" disabled={createSetMutation.isPending || !canCreateResourceSet}>
                    Create Resource Set
                  </button>
                ) : null}
                {activeResourceSetId ? (
                  <>
                    <div className="ff-resource-upload-card">
                      <label className="ff-resource-upload-label">
                        Upload CSV or JSON
                        <input type="file" accept=".csv,.json,application/json,text/csv" onChange={handleResourceUpload} />
                      </label>
                      <p>Recommended columns: source_record_key, display_name, primary_email, status, capacity_total, capacity_used.</p>
                      {uploadSummary ? <strong>{uploadSummary}</strong> : null}
                    </div>
                    <label>
                      Review Records to Activate
                      <textarea value={recordsJson} onChange={(event) => setRecordsJson(event.target.value)} required />
                    </label>
                    {error ? <div className="ff-empty-state">{error}</div> : null}
                    <button type="submit" className="btn btn-primary" disabled={snapshotMutation.isPending || !canActivateRecords}>
                      Activate Records
                    </button>
                  </>
                ) : null}
              </form>
            </section>
          ) : (
            <div className="ff-policy-editor-placeholder">
              <span className="ff-policy-placeholder-icon">
                <i className="fa fa-database" aria-hidden="true" />
              </span>
              <h2>Select or Create a Resource Set</h2>
              <p>Open an existing resource set from the list, or create a new pool before loading records.</p>
            </div>
          )}
        </main>

        <aside className="ff-resource-review" aria-label="Active record review">
          <section className="ff-runtime-panel">
            <h2>Active Records</h2>
            <p className="ff-admin-helper">
              {activeResourceSet
                ? `These are the records matching policies can evaluate for ${activeResourceSet.display_name}.`
                : "Open a resource set to review its active records."}
            </p>
            <div className="ff-admin-list">
              {(recordsQuery.data?.records ?? []).map((record) => (
                <article key={record.id} className={`ff-admin-card ff-resource-record-card ${record.id === editingRecordId ? "is-active" : ""}`}>
                  <div>
                    <h3>{record.display_name || record.source_record_key}</h3>
                    <p>
                      {record.primary_email || "No email"} · {record.effective_status || "unknown"} · capacity {record.capacity_available ?? "n/a"}
                    </p>
                  </div>
                  <div className="ff-resource-record-actions">
                    <button
                      type="button"
                      className="btn btn-outline-secondary ff-resource-record-icon-button"
                      onClick={() => startEditingRecord(record)}
                      aria-label={`Edit ${record.display_name || record.source_record_key}`}
                      title="Edit record"
                    >
                      <i className="fa fa-pen" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-danger ff-resource-record-icon-button"
                      disabled={deleteRecordMutation.isPending}
                      onClick={() => deleteRecordMutation.mutate(record.id)}
                      aria-label={`Delete ${record.display_name || record.source_record_key}`}
                      title="Delete record"
                    >
                      <i className="fa fa-trash" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))}
              {activeResourceSetId && !recordsQuery.isLoading && !(recordsQuery.data?.records ?? []).length ? (
                <div className="ff-empty-state">No active records yet. Activate records to populate this resource set.</div>
              ) : null}
              {!activeResourceSetId ? <div className="ff-empty-state">No resource set selected.</div> : null}
            </div>
          </section>
        </aside>
        {activeRecord && recordDraft ? (
          <div className="ff-resource-record-drawer-backdrop" role="presentation" onMouseDown={closeRecordDrawer}>
            <aside
              className="ff-resource-record-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="ff-resource-record-drawer-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <form
                className="ff-resource-record-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveRecordDraft();
                }}
              >
                <header className="ff-resource-record-drawer-header">
                  <div>
                    <div className="ff-eyebrow">Active record</div>
                    <h2 id="ff-resource-record-drawer-title">Edit {activeRecord.display_name || activeRecord.source_record_key}</h2>
                  </div>
                  <button type="button" className="btn btn-outline-secondary ff-resource-record-icon-button" onClick={closeRecordDrawer} aria-label="Close record editor">
                    <i className="fa fa-times" aria-hidden="true" />
                  </button>
                </header>

                <section className="ff-resource-record-form-grid">
                  <label>
                    Record Key
                    <input
                      type="text"
                      value={recordDraft.source_record_key}
                      onChange={(event) => updateRecordDraftField("source_record_key", event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Record Display Name
                    <input
                      type="text"
                      value={recordDraft.display_name}
                      onChange={(event) => updateRecordDraftField("display_name", event.target.value)}
                    />
                  </label>
                  <label>
                    Email
                    <input
                      type="email"
                      value={recordDraft.primary_email}
                      onChange={(event) => updateRecordDraftField("primary_email", event.target.value)}
                    />
                  </label>
                  <label>
                    Phone
                    <input
                      type="text"
                      value={recordDraft.primary_phone}
                      onChange={(event) => updateRecordDraftField("primary_phone", event.target.value)}
                    />
                  </label>
                  <label>
                    Record Status
                    <input type="text" value={recordDraft.status} onChange={(event) => updateRecordDraftField("status", event.target.value)} />
                  </label>
                  <label>
                    Effective Status
                    <input
                      type="text"
                      value={recordDraft.effective_status}
                      onChange={(event) => updateRecordDraftField("effective_status", event.target.value)}
                    />
                  </label>
                  <label>
                    Availability
                    <input
                      type="text"
                      value={recordDraft.availability_status}
                      onChange={(event) => updateRecordDraftField("availability_status", event.target.value)}
                    />
                  </label>
                  <label>
                    Capacity Total
                    <input
                      type="number"
                      value={recordDraft.capacity_total}
                      onChange={(event) => updateRecordDraftField("capacity_total", event.target.value)}
                    />
                  </label>
                  <label>
                    Capacity Used
                    <input
                      type="number"
                      value={recordDraft.capacity_used}
                      onChange={(event) => updateRecordDraftField("capacity_used", event.target.value)}
                    />
                  </label>
                  <label>
                    Capacity Available
                    <input
                      type="number"
                      value={recordDraft.capacity_available}
                      onChange={(event) => updateRecordDraftField("capacity_available", event.target.value)}
                    />
                  </label>
                  <label>
                    Current Load
                    <input
                      type="number"
                      value={recordDraft.current_load}
                      onChange={(event) => updateRecordDraftField("current_load", event.target.value)}
                    />
                  </label>
                  <label>
                    Service Area
                    <input
                      type="text"
                      value={recordDraft.service_area}
                      onChange={(event) => updateRecordDraftField("service_area", event.target.value)}
                    />
                  </label>
                  <label>
                    Timezone
                    <input type="text" value={recordDraft.timezone} onChange={(event) => updateRecordDraftField("timezone", event.target.value)} />
                  </label>
                  <label>
                    Tags
                    <input type="text" value={recordDraft.tags} onChange={(event) => updateRecordDraftField("tags", event.target.value)} />
                  </label>
                  <label>
                    Validation Status
                    <input
                      type="text"
                      value={recordDraft.validation_status}
                      onChange={(event) => updateRecordDraftField("validation_status", event.target.value)}
                    />
                  </label>
                  <label className="ff-resource-record-checkbox">
                    <input
                      type="checkbox"
                      checked={recordDraft.source_missing}
                      onChange={(event) => updateRecordDraftField("source_missing", event.target.checked)}
                    />
                    Source missing
                  </label>
                </section>

                <ResourceRecordCustomFields
                  entries={recordDraft.normalized_profile}
                  label="Normalized Profile"
                  section="normalized_profile"
                  onAdd={addRecordDraftEntry}
                  onChange={updateRecordDraftEntry}
                  onRemove={removeRecordDraftEntry}
                />
                <ResourceRecordCustomFields
                  entries={recordDraft.attributes}
                  label="Attributes"
                  section="attributes"
                  onAdd={addRecordDraftEntry}
                  onChange={updateRecordDraftEntry}
                  onRemove={removeRecordDraftEntry}
                />

                {recordEditError ? <div className="ff-empty-state">{recordEditError}</div> : null}
                <footer className="ff-resource-record-drawer-actions">
                  <button type="submit" className="btn btn-primary" disabled={updateRecordMutation.isPending}>
                    Save Record
                  </button>
                  <button type="button" className="btn btn-outline-secondary" onClick={closeRecordDrawer}>
                    Cancel
                  </button>
                </footer>
              </form>
            </aside>
          </div>
        ) : null}
      </section>
    </main>
  );
}
