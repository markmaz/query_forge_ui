import { useQuery } from "@tanstack/react-query";
import { Alert, Badge, Spinner, Table } from "reactstrap";
import { getIngestionHistory } from "../../../../shared/services/ingestion";
import type { IngestionRun } from "../../../../shared/services/ingestion";

interface Props {
  onSelectRun: (jobId: string) => void;
}

const STATUS_COLOR: Record<string, string> = {
  running: "warning",
  completed: "success",
  failed: "danger",
};

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return "running";
  try {
    const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
    if (!isFinite(ms) || ms < 0) return "—";
    const seconds = Math.floor(ms / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  } catch {
    return "—";
  }
}

export default function SyncHistoryTable({ onSelectRun }: Props) {
  const {
    data: runs = [],
    isLoading,
    isError,
  } = useQuery<IngestionRun[], Error>({
    queryKey: ["ingestion", "history"],
    queryFn: getIngestionHistory,
    refetchInterval: 10_000,
  });

  if (isLoading) {
    return (
      <div className="d-flex align-items-center gap-2">
        <Spinner size="sm" />
        <span>Loading history…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <Alert color="danger" role="alert">
        Could not load sync history. Refresh the page to try again.
      </Alert>
    );
  }

  if (runs.length === 0) {
    return (
      <p className="text-muted" role="status" aria-live="polite">
        No sync runs yet.
      </p>
    );
  }

  return (
    <div className="table-responsive">
      <Table hover size="sm" aria-label="Sync history">
        <thead>
          <tr>
            <th scope="col">Datasource</th>
            <th scope="col">Schema</th>
            <th scope="col">Started</th>
            <th scope="col">Duration</th>
            <th scope="col">Tables synced</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr
              key={run.id}
              style={{ cursor: "pointer" }}
              onClick={() => onSelectRun(run.id)}
              tabIndex={0}
              aria-label={`View sync run for ${run.datasource} / ${run.schema_name}, started ${formatDateTime(run.started_at)}, status: ${run.status}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectRun(run.id);
                }
              }}
            >
              <td>{run.datasource}</td>
              <td>{run.schema_name}</td>
              <td>{formatDateTime(run.started_at)}</td>
              <td>{formatDuration(run.started_at, run.completed_at)}</td>
              <td>{run.tables_created + run.tables_updated}</td>
              <td>
                <Badge color={STATUS_COLOR[run.status] ?? "secondary"}>
                  {run.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
