import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardBody, CardHeader, Col, Container, Row } from "reactstrap";
import SyncConfigForm from "./components/SyncConfigForm";
import SyncProgressMonitor from "./components/SyncProgressMonitor";
import SyncHistoryTable from "./components/SyncHistoryTable";
import { useSyncJob } from "../hooks/useSyncJob";
import { startSync } from "../../../shared/services/ingestion";
import type { SyncRequest } from "../../../shared/services/ingestion";

export default function IngestionPage() {
  const queryClient = useQueryClient();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [view, setView] = useState<"form" | "progress">("form");
  const { status: activeJobStatus } = useSyncJob(activeJobId, Boolean(activeJobId));
  const hasRunningSync = activeJobStatus === "running";

  const mutation = useMutation({
    mutationFn: startSync,
    onSuccess: ({ job_id }) => {
      setActiveJobId(job_id);
      setView("progress");
      queryClient.invalidateQueries({ queryKey: ["ingestion", "history"] });
    },
  });

  const handleSubmit = (payload: SyncRequest) => mutation.mutate(payload);

  const handleNewSync = () => {
    setView("form");
    // Keep activeJobId so we can continue polling and warn only if that run is still running.
  };

  const handleBackToSyncSetup = () => {
    setView("form");
  };

  const handleSelectRun = (jobId: string) => {
    setActiveJobId(jobId);
    setView("progress");
  };

  return (
    <Container fluid>
      <h1 className="visually-hidden">Ingestion</h1>
      <Row className="mb-3">
        <Col xs="12">
          <Card>
            <CardHeader tag="h2" className="h6 mb-0">
              Metadata Sync
            </CardHeader>
            <CardBody>
              {view === "form" ? (
                <SyncConfigForm
                  onSubmit={handleSubmit}
                  isSubmitting={mutation.isPending}
                  hasRunningSync={hasRunningSync}
                />
              ) : (
                activeJobId && (
                  <SyncProgressMonitor
                    jobId={activeJobId}
                    onNewSync={handleNewSync}
                    onBackToSyncSetup={handleBackToSyncSetup}
                  />
                )
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>
      <Row>
        <Col xs="12">
          <Card>
            <CardHeader tag="h2" className="h6 mb-0">
              Sync History
            </CardHeader>
            <CardBody>
              <SyncHistoryTable onSelectRun={handleSelectRun} />
            </CardBody>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
