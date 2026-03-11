import { Alert, Badge, Card, CardBody, Progress, Spinner } from "reactstrap";
import { useSyncJob } from "../../hooks/useSyncJob";
import type { IngestionRun } from "../../../../shared/services/ingestion";

interface Props {
  jobId: string;
  onNewSync: () => void;
  onBackToSyncSetup: () => void;
}

type SyncStatus = IngestionRun["status"];

const STATUS_COLOR: Record<SyncStatus, string> = {
  running: "warning",
  completed: "success",
  failed: "danger",
};

function StatusBadge({ status }: { status: SyncStatus | null }) {
  if (!status) return null;
  return (
    <Badge color={STATUS_COLOR[status] ?? "secondary"} className="me-2">
      {status}
    </Badge>
  );
}

function formatElapsed(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  if (!isFinite(ms) || ms < 0) return "0m 0s";
  const seconds = Math.floor(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default function SyncProgressMonitor({
  jobId,
  onNewSync,
  onBackToSyncSetup,
}: Props) {
  const { data, status, isLoading, error } = useSyncJob(jobId || null, true);

  if (isLoading) {
    return (
      <div className="d-flex align-items-center gap-2">
        <Spinner size="sm" />
        <span>Loading job status…</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert color="danger" role="alert">
        Failed to load job status. Check your connection and try again.
      </Alert>
    );
  }

  if (!data) return null;

  const pct =
    data.tables_total > 0
      ? Math.round((data.tables_done / data.tables_total) * 100)
      : 0;
  const columnsTotal = Number(data.columns_total ?? 0);
  const columnsDone = Number(data.columns_done ?? 0);
  const columnsFailed = Number(data.columns_failed ?? 0);
  const columnsRemaining = Math.max(columnsTotal - columnsDone, 0);
  const columnsPct =
    columnsTotal > 0 ? Math.round((columnsDone / columnsTotal) * 100) : 0;
  const phaseLabel = (data.current_phase ?? "running").replace(/_/g, " ");
  const currentTarget = data.current_column
    ? `${data.current_table ?? "table"}.${data.current_column}`
    : data.current_table ?? null;

  return (
    <Card>
      <CardBody>
        <div className="d-flex align-items-center mb-3">
          <StatusBadge status={status} />
          <strong>{data.datasource}</strong>
          <span className="ms-2 text-muted">/ {data.schema_name}</span>
        </div>
        <div className="mb-3">
          <button
            type="button"
            className="btn btn-link btn-sm px-0"
            onClick={onBackToSyncSetup}
          >
            Back to Sync Setup
          </button>
        </div>

        {status === "running" && (
          <>
            <div id="sync-progress-label" className="visually-hidden">
              Sync progress: {pct}% complete ({data.tables_done} of{" "}
              {data.tables_total} tables)
            </div>
            <Progress
              value={pct}
              min={0}
              max={100}
              barAriaLabelledBy="sync-progress-label"
              className="mb-2"
            />
            <div
              className="d-flex gap-4 text-muted small mb-2"
              aria-hidden="true"
            >
              <span>
                {data.tables_done} / {data.tables_total} tables
              </span>
              {data.tables_failed > 0 && (
                <span className="text-danger">{data.tables_failed} failed</span>
              )}
              <span>Elapsed: {formatElapsed(data.started_at)}</span>
            </div>
            <div className="text-muted small mb-2" aria-live="polite">
              Phase: {phaseLabel}
            </div>
            {columnsTotal > 0 && (
              <>
                <div id="column-progress-label" className="visually-hidden">
                  Column progress: {columnsPct}% complete ({columnsDone} of{" "}
                  {columnsTotal} columns)
                </div>
                <Progress
                  value={columnsPct}
                  min={0}
                  max={100}
                  barAriaLabelledBy="column-progress-label"
                  className="mb-2"
                />
                <div className="d-flex gap-4 text-muted small mb-2" aria-hidden="true">
                  <span>
                    {columnsDone} / {columnsTotal} columns
                  </span>
                  <span>{columnsRemaining} remaining</span>
                  {columnsFailed > 0 && (
                    <span className="text-danger">{columnsFailed} failed</span>
                  )}
                </div>
              </>
            )}
            {currentTarget && (
              <div className="text-muted small mb-2" aria-live="polite">
                Working on: <code>{currentTarget}</code>
              </div>
            )}
          </>
        )}

        {status === "completed" && (
          <>
            <Alert
              color="success"
              className="mb-3"
              role="status"
              aria-live="polite"
            >
              <strong>Sync complete.</strong>{" "}
              {data.tables_created} tables discovered and synced,{" "}
              {data.columns_created} columns synced.
              {data.tables_updated > 0 &&
                ` Profiled ${data.tables_updated} table(s).`}
              {data.columns_updated > 0 &&
                ` AI-enriched ${data.columns_updated} column description(s).`}
              {data.tables_failed > 0 && ` ${data.tables_failed} operation(s) failed.`}
            </Alert>
            {data.error && (
              <Alert color="warning" role="status" aria-live="polite">
                {data.error}
              </Alert>
            )}
          </>
        )}

        {status === "failed" && (
          <Alert color="danger" role="alert" aria-live="assertive">
            <strong>Sync failed.</strong>{" "}
            {data.error ?? "An unexpected error occurred. Please try again."}
          </Alert>
        )}

        {(status === "completed" || status === "failed") && (
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={onNewSync}
          >
            Start New Sync
          </button>
        )}
      </CardBody>
    </Card>
  );
}
