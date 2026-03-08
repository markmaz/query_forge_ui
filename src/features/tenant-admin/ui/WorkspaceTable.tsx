import React, { useEffect, useMemo, useState } from "react";
import { Input, Label, Spinner } from "reactstrap";
import { useAppDispatch, useAppSelector } from "../../../shared/runtime/hooks";
import StyledTable from "../../../shared/components/StyledTable";
import { fetchWorkspaceInfo } from "../model/workspaceSlice";

export type WorkspaceSelection = {
  workspace_id: string;
  is_default: boolean;
};

type Props = {
  onSelectionChange: (selected: WorkspaceSelection[]) => void;
  selected?: WorkspaceSelection[];
  selectedIds?: string[];
  singleSelect?: boolean;
};

const ITEMS_PER_PAGE = 7;

type SelectionMap = Record<string, boolean>;

function mapToSelectionArray(map: SelectionMap): WorkspaceSelection[] {
  return Object.entries(map).map(([workspace_id, is_default]) => ({
    workspace_id: String(workspace_id),
    is_default: Boolean(is_default),
  }));
}

function fromSelectedProp(selected?: WorkspaceSelection[], selectedIds?: string[]): SelectionMap {
  if (Array.isArray(selected)) {
    return selected.reduce<SelectionMap>((accumulator, item) => {
      accumulator[String(item.workspace_id)] = Boolean(item.is_default);
      return accumulator;
    }, {});
  }

  if (Array.isArray(selectedIds)) {
    return selectedIds.reduce<SelectionMap>((accumulator, id) => {
      accumulator[String(id)] = false;
      return accumulator;
    }, {});
  }

  return {};
}

const WorkspaceTable: React.FC<Props> = ({
  onSelectionChange,
  selected,
  selectedIds,
  singleSelect = false,
}) => {
  const dispatch = useAppDispatch();
  const { workspaces, loading, error } = useAppSelector((state) => state.workspaces);

  const [selectedMap, setSelectedMap] = useState<SelectionMap>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    dispatch(fetchWorkspaceInfo());
  }, [dispatch]);

  useEffect(() => {
    setSelectedMap(fromSelectedProp(selected, selectedIds));
  }, [selected, selectedIds]);

  useEffect(() => {
    if (!Array.isArray(workspaces)) return;

    const allowedIds = new Set(workspaces.map((workspace) => String(workspace.workspace_id)));
    const next: SelectionMap = {};
    let changed = false;

    Object.entries(selectedMap).forEach(([id, isDefault]) => {
      if (!allowedIds.has(id)) {
        changed = true;
        return;
      }
      next[id] = isDefault;
    });

    if (changed) {
      setSelectedMap(next);
      onSelectionChange(mapToSelectionArray(next));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaces]);

  const selectedIdsSet = useMemo(() => new Set(Object.keys(selectedMap)), [selectedMap]);

  const visibleWorkspaces = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    const source = workspaces || [];

    const filtered = !normalizedTerm
      ? source
      : source.filter((workspace) => {
          return (
            workspace.name.toLowerCase().includes(normalizedTerm) ||
            workspace.server.toLowerCase().includes(normalizedTerm)
          );
        });

    return [...filtered].sort((left, right) => left.name.localeCompare(right.name));
  }, [workspaces, searchTerm]);

  const pageCount = Math.max(1, Math.ceil(visibleWorkspaces.length / ITEMS_PER_PAGE));
  const pageStart = (page - 1) * ITEMS_PER_PAGE;
  const pageRows = visibleWorkspaces.slice(pageStart, pageStart + ITEMS_PER_PAGE);

  const toggleWorkspace = (workspaceId: string) => {
    setSelectedMap((previous) => {
      let next: SelectionMap;

      if (singleSelect) {
        const preservedDefault = Object.prototype.hasOwnProperty.call(previous, workspaceId)
          ? previous[workspaceId]
          : false;
        next = { [workspaceId]: preservedDefault };
      } else {
        next = { ...previous };
        if (Object.prototype.hasOwnProperty.call(next, workspaceId)) {
          delete next[workspaceId];
        } else {
          next[workspaceId] = false;
        }
      }

      onSelectionChange(mapToSelectionArray(next));
      return next;
    });
  };

  if (loading) return <Spinner color="primary" />;
  if (error) return <div className="text-danger">Error: {error}</div>;

  return (
    <div className="mt-4">
      <Label>Assign Organization (WorkSpace)</Label>

      {selectedIdsSet.size > 0 ? (
        <div className="mt-2 mb-3">
          {(workspaces || [])
            .filter((workspace) => selectedIdsSet.has(String(workspace.workspace_id)))
            .sort((left, right) => left.name.localeCompare(right.name))
            .map((workspace) => (
              <span
                key={workspace.workspace_id}
                className="badge bg-primary text-white me-2 mb-2"
                style={{
                  fontSize: "0.75rem",
                  padding: "0.4em 0.6em",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                {workspace.name}
                <button
                  type="button"
                  className="btn-close btn-close-white btn-sm ms-2"
                  aria-label={`Remove ${workspace.name}`}
                  style={{ fontSize: "0.6rem" }}
                  onClick={() => toggleWorkspace(String(workspace.workspace_id))}
                />
              </span>
            ))}
        </div>
      ) : null}

      <div className="mb-3">
        <Input
          type="text"
          placeholder="Search workspaces..."
          value={searchTerm}
          onChange={(event) => {
            setSearchTerm(event.target.value);
            setPage(1);
          }}
        />
      </div>

      <StyledTable>
        <thead>
          <tr>
            <th style={{ width: 48 }} />
            <th>Workspace Name</th>
            <th>Server</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((workspace) => (
            <tr key={workspace.workspace_id}>
              <td>
                <Input
                  type={singleSelect ? "radio" : "checkbox"}
                  name="workspace-select"
                  checked={selectedIdsSet.has(String(workspace.workspace_id))}
                  onChange={() => toggleWorkspace(String(workspace.workspace_id))}
                  aria-label={`Select ${workspace.name}`}
                />
              </td>
              <td>{workspace.name}</td>
              <td>{workspace.server}</td>
            </tr>
          ))}
        </tbody>
      </StyledTable>

      <div className="d-flex justify-content-between align-items-center mt-3">
        <button
          className="btn btn-secondary"
          disabled={page === 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
        >
          Previous
        </button>

        <span className="fw-bold">
          Page {page} of {pageCount}
        </span>

        <button
          className="btn btn-secondary"
          disabled={page === pageCount || pageCount === 0}
          onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default WorkspaceTable;
