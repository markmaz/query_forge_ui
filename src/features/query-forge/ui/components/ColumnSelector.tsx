import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import ReactDOM from "react-dom";
import type { DomainColumnRef, FieldRef } from "../../model/domainCatalog";
import type { SqlColumnKey } from "../../model/sqlJson";
import { colKey, labelFor, sameCol } from "../../model/sqlJson";

type AnchorPosition = { top: number; left: number; width: number };

const selectedPillStyle: React.CSSProperties = {
  color: "rgb(26, 86, 82)",
  background: "rgba(26, 86, 82, 0.12)",
  border: "1px solid rgba(26, 86, 82, 0.25)",
};

function useAnchoredMenu(isOpen: boolean, onDismiss: () => void) {
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<AnchorPosition | null>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const onOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      onDismiss();
    };

    const onViewportChange = () => updatePosition();

    document.addEventListener("mousedown", onOutsideClick);
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);

    return () => {
      document.removeEventListener("mousedown", onOutsideClick);
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
    };
  }, [isOpen, onDismiss, updatePosition]);

  return { triggerRef, menuRef, position, updatePosition };
}

function AnchoredPortalMenu({
  open,
  position,
  menuRef,
  children,
}: {
  open: boolean;
  position: AnchorPosition | null;
  menuRef: React.RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  if (!open || !position) return null;

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      className="border rounded shadow-sm bg-white position-absolute mt-1"
      style={{
        zIndex: 2000,
        width: position.width,
        maxHeight: 320,
        overflow: "auto",
        top: position.top,
        left: position.left,
      }}
    >
      {children}
    </div>,
    document.body
  );
}

function selectableRow(
  label: string,
  selected: boolean,
  showSelectedBadge: boolean,
  onClick: () => void,
  key: string
) {
  return (
    <div
      key={key}
      className="px-3 py-2 d-flex align-items-center justify-content-between"
      role="button"
      onClick={onClick}
      style={selected ? { background: "rgba(0,0,0,0.03)" } : undefined}
    >
      <div className="text-truncate" style={{ maxWidth: "85%", ...(selected ? { color: "rgb(26, 86, 82)" } : null) }}>
        {label}
      </div>
      {showSelectedBadge && selected ? <span className="badge" style={selectedPillStyle}>Selected</span> : null}
    </div>
  );
}

type ColumnPickerProps = {
  columns: DomainColumnRef[];
  selectedColumnKeys?: string[];
  value: FieldRef | null;
  onChange: (next: FieldRef | null) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  showTable?: boolean;
};

function getDomainColumnLabel(column: DomainColumnRef, showTable?: boolean) {
  if (showTable && column.tableAlias) return `${column.tableAlias}.${column.columnName}`;
  return showTable ? `${column.modelTableName}.${column.columnName}` : column.columnName;
}

function resolveFieldLabel(
  value: FieldRef | null,
  byIdentity: Map<string, DomainColumnRef>,
  showTable: boolean
) {
  if (!value) return "";
  if (value.kind === "computed") return `ƒ ${value.id}`;
  if (value.kind === "column") {
    const key = `${value.workspaceTableId}:${value.columnName}`;
    const hit = byIdentity.get(key);
    return hit ? getDomainColumnLabel(hit, showTable) : `Column ${value.columnName}`;
  }

  return `Column ${(value as { id?: string }).id ?? ""}`;
}

export const ColumnPicker: React.FC<ColumnPickerProps> = ({
  columns,
  selectedColumnKeys = [],
  value,
  onChange,
  placeholder = "Search columns…",
  disabled,
  allowClear = true,
  showTable = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { triggerRef, menuRef, position } = useAnchoredMenu(open, () => {
    setOpen(false);
    setQuery("");
  });

  const selectedSet = useMemo(() => new Set(selectedColumnKeys), [selectedColumnKeys]);

  const byIdentity = useMemo(() => {
    const map = new Map<string, DomainColumnRef>();
    columns.forEach((column) => map.set(column.identityKey, column));
    return map;
  }, [columns]);

  const currentLabel = useMemo(
    () => resolveFieldLabel(value, byIdentity, showTable),
    [value, byIdentity, showTable]
  );

  const loweredQuery = query.trim().toLowerCase();

  const filteredColumns = useMemo(() => {
    if (!loweredQuery) return columns;

    return columns.filter((column) => {
      const columnName = column.columnName.toLowerCase();
      const tableName = column.modelTableName.toLowerCase();
      const description = (column.description ?? "").toLowerCase();
      return (
        columnName.includes(loweredQuery) ||
        tableName.includes(loweredQuery) ||
        description.includes(loweredQuery)
      );
    });
  }, [columns, loweredQuery]);

  const selectedColumns = useMemo(() => {
    return filteredColumns
      .filter((column) => selectedSet.has(column.identityKey))
      .sort((left, right) =>
        getDomainColumnLabel(left, showTable).localeCompare(
          getDomainColumnLabel(right, showTable)
        )
      );
  }, [filteredColumns, selectedSet, showTable]);

  const unselectedColumns = useMemo(() => {
    return filteredColumns
      .filter((column) => !selectedSet.has(column.identityKey))
      .sort((left, right) =>
        getDomainColumnLabel(left, showTable).localeCompare(
          getDomainColumnLabel(right, showTable)
        )
      );
  }, [filteredColumns, selectedSet, showTable]);

  const pickColumn = (column: DomainColumnRef) => {
    onChange({
      kind: "column",
      workspaceTableId: column.workspaceTableId,
      columnName: column.columnName,
      modelColumnId: column.modelColumnId ?? null,
    });
    setOpen(false);
    setQuery("");
  };

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="position-relative" ref={triggerRef}>
      <button
        type="button"
        className="form-control form-control-sm d-flex align-items-center justify-content-between"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        style={{ cursor: disabled ? "not-allowed" : "pointer", maxWidth: 360 }}
      >
        <span className="text-truncate" style={{ maxWidth: "92%" }}>
          {value ? currentLabel : <span className="text-muted">{placeholder}</span>}
        </span>
        <i className={`fa fa-chevron-${open ? "up" : "down"}`} aria-hidden="true" />
      </button>

      <AnchoredPortalMenu open={open && !disabled} position={position} menuRef={menuRef}>
        <div className="p-2 border-bottom">
          <input
            className="form-control form-control-sm"
            placeholder={placeholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />

          <div className="d-flex align-items-center justify-content-between mt-2">
            <small className="text-muted">
              {filteredColumns.length} column{filteredColumns.length === 1 ? "" : "s"}
            </small>
            {allowClear ? (
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => onChange(null)}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        {selectedColumns.length > 0 ? (
          <div className="p-2">
            <div className="text-muted small fw-semibold mb-1">Selected</div>
            <div className="list-group list-group-flush">
              {selectedColumns.map((column) => (
                <button
                  type="button"
                  key={column.identityKey}
                  className="list-group-item list-group-item-action py-2"
                  onClick={() => pickColumn(column)}
                  title={column.description ?? ""}
                >
                  <div className="d-flex justify-content-between">
                    <div className="text-truncate" style={{ color: "rgb(26, 86, 82)" }}>
                      {getDomainColumnLabel(column, showTable)}
                    </div>
                    <span className="badge" style={selectedPillStyle}>
                      Selected
                    </span>
                  </div>
                  {column.description ? (
                    <div className="small text-muted text-truncate">{column.description}</div>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="p-2 pt-0">
          <div className="text-muted small fw-semibold mb-1">All columns</div>
          <div className="list-group list-group-flush">
            {unselectedColumns.length === 0 ? (
              <div className="text-muted small px-2 py-2">No matches.</div>
            ) : (
              unselectedColumns.map((column) => (
                <button
                  type="button"
                  key={column.identityKey}
                  className="list-group-item list-group-item-action py-2"
                  onClick={() => pickColumn(column)}
                  title={column.description ?? ""}
                >
                  <div className="text-truncate">{getDomainColumnLabel(column, showTable)}</div>
                  {column.description ? (
                    <div className="small text-muted text-truncate">{column.description}</div>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="p-2 border-top d-flex justify-content-end">
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={close}>
            Close
          </button>
        </div>
      </AnchoredPortalMenu>
    </div>
  );
};

type SqlColumnPickerProps = {
  columns: SqlColumnKey[];
  selectedColumns?: SqlColumnKey[];
  value: SqlColumnKey | null;
  onChange: (next: SqlColumnKey | null) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  showSelectedBadge?: boolean;
  labelByKey?: Map<string, string>;
  groupLabelByKey?: Map<string, string>;
};

export const SqlColumnPicker: React.FC<SqlColumnPickerProps> = ({
  columns,
  selectedColumns = [],
  value,
  onChange,
  placeholder = "Search columns…",
  disabled,
  allowClear = true,
  showSelectedBadge,
  labelByKey,
  groupLabelByKey,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { triggerRef, menuRef, position } = useAnchoredMenu(open, () => {
    setOpen(false);
    setQuery("");
  });

  const selectedSet = useMemo(
    () => new Set(selectedColumns.map((column) => colKey(column))),
    [selectedColumns]
  );

  const getSqlLabel = useCallback(
    (column: SqlColumnKey) => labelByKey?.get(colKey(column)) ?? labelFor(column),
    [labelByKey]
  );

  const currentLabel = useMemo(() => {
    if (!value) return "";
    return getSqlLabel(value);
  }, [value, getSqlLabel]);

  const loweredQuery = query.trim().toLowerCase();

  const filteredColumns = useMemo(() => {
    if (!loweredQuery) return columns;
    return columns.filter((column) => {
      const label = getSqlLabel(column).toLowerCase();
      const columnName = (column.columnName ?? "").toLowerCase();
      return label.includes(loweredQuery) || columnName.includes(loweredQuery);
    });
  }, [columns, loweredQuery, getSqlLabel]);

  const selectedItems = useMemo(() => {
    return filteredColumns
      .filter((column) => selectedSet.has(colKey(column)))
      .sort((left, right) => getSqlLabel(left).localeCompare(getSqlLabel(right)));
  }, [filteredColumns, selectedSet, getSqlLabel]);

  const unselectedItems = useMemo(() => {
    return filteredColumns
      .filter((column) => !selectedSet.has(colKey(column)))
      .sort((left, right) => getSqlLabel(left).localeCompare(getSqlLabel(right)));
  }, [filteredColumns, selectedSet, getSqlLabel]);

  const groupedUnselected = useMemo(() => {
    const groups = new Map<string, SqlColumnKey[]>();
    const ungrouped: SqlColumnKey[] = [];

    unselectedItems.forEach((column) => {
      const group = groupLabelByKey?.get(colKey(column));
      if (!group) {
        ungrouped.push(column);
        return;
      }

      const bucket = groups.get(group) ?? [];
      bucket.push(column);
      groups.set(group, bucket);
    });

    return { groups, ungrouped };
  }, [unselectedItems, groupLabelByKey]);

  const pickColumn = (column: SqlColumnKey) => {
    onChange(column);
    setOpen(false);
    setQuery("");
  };

  const clearSelection = () => {
    onChange(null);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="position-relative" ref={triggerRef}>
      <button
        type="button"
        className="form-control form-control-sm d-flex align-items-center justify-content-between"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        style={{ cursor: disabled ? "not-allowed" : "pointer", maxWidth: 360 }}
      >
        <span className="text-truncate" style={{ maxWidth: "92%" }}>
          {value ? currentLabel : <span className="text-muted">{placeholder}</span>}
        </span>
        <i className={`fa fa-chevron-${open ? "up" : "down"}`} aria-hidden="true" />
      </button>

      <AnchoredPortalMenu open={open && !disabled} position={position} menuRef={menuRef}>
        <div className="p-2 border-bottom">
          <input
            className="form-control form-control-sm"
            placeholder={placeholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />
        </div>

        {selectedItems.length > 0 ? (
          <>
            <div className="px-3 pt-2 pb-1 text-uppercase text-muted small">Selected</div>
            {selectedItems.map((column) => {
              const key = colKey(column);
              const isActive = value ? sameCol(value, column) : false;
              return selectableRow(
                getSqlLabel(column),
                selectedSet.has(key),
                Boolean(showSelectedBadge),
                () => pickColumn(column),
                `selected-${key}-${isActive ? "active" : "inactive"}`
              );
            })}
            <div className="border-top" />
          </>
        ) : null}

        {[...groupedUnselected.groups.entries()].map(([groupLabel, items]) => (
          <React.Fragment key={groupLabel}>
            <div className="px-3 pt-2 pb-1 text-uppercase text-muted small">{groupLabel}</div>
            {items.map((column) => {
              const key = colKey(column);
              return selectableRow(
                getSqlLabel(column),
                selectedSet.has(key),
                Boolean(showSelectedBadge),
                () => pickColumn(column),
                `group-${groupLabel}-${key}`
              );
            })}
          </React.Fragment>
        ))}

        {groupedUnselected.ungrouped.map((column) => {
          const key = colKey(column);
          return selectableRow(
            getSqlLabel(column),
            selectedSet.has(key),
            Boolean(showSelectedBadge),
            () => pickColumn(column),
            `ungrouped-${key}`
          );
        })}

        {allowClear && value ? (
          <div className="border-top px-3 py-2">
            <button
              type="button"
              className="btn btn-sm btn-link p-0 text-decoration-none"
              onClick={clearSelection}
            >
              Clear selection
            </button>
          </div>
        ) : null}
      </AnchoredPortalMenu>
    </div>
  );
};
