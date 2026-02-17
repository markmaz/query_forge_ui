import React from "react";

export type DataTableColumn<TRow> = {
  key: string;
  label: string;
  className?: string;
  headerClassName?: string;
  render: (row: TRow) => React.ReactNode;
};

type Props<TRow> = {
  columns: DataTableColumn<TRow>[];
  rows: TRow[];
  loading?: boolean;
  error?: string | null;
  emptyText?: string;
  onRowClick?: (row: TRow) => void;
};

export function DataTable<TRow>({
  columns,
  rows,
  loading,
  error,
  emptyText = "No rows found.",
  onRowClick,
}: Props<TRow>) {
  return (
    <div className="semantic-admin-card">
      <div className="table-responsive">
        <table className="table table-hover mb-0 align-middle">
          <thead className="table-light">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={column.headerClassName}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="text-muted p-3">
                  Loading...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={columns.length} className="text-danger p-3">
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-muted p-3">
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={onRowClick ? "semantic-admin-row-clickable" : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((column) => (
                    <td key={column.key} className={column.className}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
