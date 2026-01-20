import React, { useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../../shared/lib/hooks";
import { fetchWorkspaceInfo } from "../model/workspaceSlice";
import { Input, Label, Spinner } from "reactstrap";
import StyledTable from "../../../shared/ui/StyledTable";

export type WorkspaceSelection = { workspace_id: string; is_default: boolean };

interface Props {
  onSelectionChange: (selected: WorkspaceSelection[]) => void;
  /** Optional: preselect workspaces (preferred shape) */
  selected?: WorkspaceSelection[];
  /** Back-compat: preselect by ids only (will default is_default=false) */
  selectedIds?: string[];
  /** Optional: limit selection to one workspace */
  singleSelect?: boolean;
}

const ITEMS_PER_PAGE = 7;

const WorkspaceTable: React.FC<Props> = ({
  onSelectionChange,
  selected,
  selectedIds: selectedIdsProp,
  singleSelect = false,
}) => {
  const dispatch = useAppDispatch();
  const { workspaces, loading, error } = useAppSelector((s) => s.workspaces);

  // Map of id -> is_default
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const toArray = (map: Record<string, boolean>): WorkspaceSelection[] =>
    Object.entries(map).map(([workspace_id, is_default]) => ({
      workspace_id: String(workspace_id),
      is_default: !!is_default,
    }));

  // Fetch once
  useEffect(() => {
    dispatch(fetchWorkspaceInfo());
  }, [dispatch]);

  // Hydrate from preferred prop `selected` or back-compat `selectedIds`
  useEffect(() => {
    if (selected && Array.isArray(selected)) {
      const m: Record<string, boolean> = {};
      selected.forEach((w) => (m[String(w.workspace_id)] = !!w.is_default));
      setSelectedMap(m);
      return;
    }
    if (selectedIdsProp && Array.isArray(selectedIdsProp)) {
      const m: Record<string, boolean> = {};
      selectedIdsProp.forEach((id) => (m[String(id)] = false));
      setSelectedMap(m);
    }
  }, [selected, selectedIdsProp]);

  // If workspace list changes, drop selections that no longer exist
  useEffect(() => {
    if (!Array.isArray(workspaces)) return;
    const existing = new Set(workspaces.map((w) => String(w.workspace_id)));
    const next: Record<string, boolean> = {};
    let changed = false;
    for (const [id, isDef] of Object.entries(selectedMap)) {
      if (existing.has(id)) next[id] = isDef;
      else changed = true;
    }
    if (changed) {
      setSelectedMap(next);
      onSelectionChange(toArray(next));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaces]);

  const handleToggle = (workspaceId: string) => {
    setSelectedMap((prev) => {
      let next: Record<string, boolean>;
      if (singleSelect) {
        // keep is_default if it already existed, else default false
        const isDef = prev.hasOwnProperty(workspaceId) ? prev[workspaceId] : false;
        next = { [workspaceId]: isDef };
      } else {
        next = { ...prev };
        if (next.hasOwnProperty(workspaceId)) {
          delete next[workspaceId];
        } else {
          next[workspaceId] = false; // default flag; adjust if you later add UI for setting default
        }
      }
      onSelectionChange(toArray(next));
      return next;
    });
  };

  const filteredWorkspaces = useMemo(() => {
    const list = workspaces || [];
    const term = searchTerm.toLowerCase().trim();
    const filtered = term
      ? list.filter(
          (ws) =>
            ws.name.toLowerCase().includes(term) ||
            ws.server.toLowerCase().includes(term)
        )
      : list;
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [workspaces, searchTerm]);

  const selectedIds = useMemo(() => new Set(Object.keys(selectedMap)), [selectedMap]);

  const totalPages = Math.max(1, Math.ceil(filteredWorkspaces.length / ITEMS_PER_PAGE));
  const pageStart = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedWorkspaces = filteredWorkspaces.slice(pageStart, pageStart + ITEMS_PER_PAGE);

  if (loading) return <Spinner color="primary" />;
  if (error) return <div className="text-danger">Error: {error}</div>;

  return (
    <div className="mt-4">
      <Label>Assign Organization (WorkSpace)</Label>

      {/* Selected badges */}
      {selectedIds.size > 0 && (
        <div className="mt-2 mb-3">
          {(workspaces || [])
            .filter((ws) => selectedIds.has(String(ws.workspace_id)))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((ws) => (
              <span
                key={ws.workspace_id}
                className="badge bg-primary text-white me-2 mb-2"
                style={{ fontSize: "0.75rem", padding: "0.4em 0.6em", display: "inline-flex", alignItems: "center" }}
              >
                {ws.name}
                <button
                  type="button"
                  className="btn-close btn-close-white btn-sm ms-2"
                  aria-label={`Remove ${ws.name}`}
                  style={{ fontSize: "0.6rem" }}
                  onClick={() => handleToggle(String(ws.workspace_id))}
                />
              </span>
            ))}
        </div>
      )}

      {/* Search */}
      <div className="mb-3">
        <Input
          type="text"
          placeholder="Search workspaces..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Table */}
      <StyledTable>
        <thead>
          <tr>
            <th style={{ width: 48 }}></th>
            <th>Workspace Name</th>
            <th>Server</th>
          </tr>
        </thead>
        <tbody>
          {paginatedWorkspaces.map((ws) => (
            <tr key={ws.workspace_id}>
              <td>
                <Input
                  type={singleSelect ? "radio" : "checkbox"}
                  name="workspace-select"
                  checked={selectedIds.has(String(ws.workspace_id))}
                  onChange={() => handleToggle(String(ws.workspace_id))}
                  aria-label={`Select ${ws.name}`}
                />
              </td>
              <td>{ws.name}</td>
              <td>{ws.server}</td>
            </tr>
          ))}
        </tbody>
      </StyledTable>

      {/* Pagination */}
      <div className="d-flex justify-content-between align-items-center mt-3">
        <button
          className="btn btn-secondary"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </button>

        <span className="fw-bold">Page {currentPage} of {totalPages}</span>

        <button
          className="btn btn-secondary"
          disabled={currentPage === totalPages || totalPages === 0}
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
        >
          Next
          </button>
      </div>
    </div>
  );
};

export default WorkspaceTable;
