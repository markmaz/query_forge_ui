import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  listFlowForgeDataDestinations,
  listFlowForgeDataSources,
  testFlowForgeDataDestination,
  testFlowForgeDataSource,
  updateFlowForgeDataDestination,
  updateFlowForgeDataSource,
  upsertFlowForgeDataDestination,
  upsertFlowForgeDataSource,
} from "../api/dataMovementApi";
import DataMovementReviewPanels from "../components/DataMovementReviewPanels";
import FlowForgePageHeader from "../components/FlowForgePageHeader";
import StatusBadge from "../components/StatusBadge";
import type { FlowForgeDataDestination, FlowForgeDataSource } from "../model/dataMovementTypes";
import "./flowforge.css";
import "./flowforgeAdmin.css";

type SourceDraft = {
  source_key: string;
  display_name: string;
  source_type: string;
  mode: string;
  enabled: boolean;
  configJson: string;
};

type DestinationDraft = {
  destination_key: string;
  display_name: string;
  destination_type: string;
  mode: string;
  enabled: boolean;
  configJson: string;
};

const defaultSourceDraft: SourceDraft = {
  source_key: "local-import",
  display_name: "Local Import",
  source_type: "local_file_test",
  mode: "test",
  enabled: true,
  configJson: JSON.stringify({ base_dir: "/tmp/flowforge-imports" }, null, 2),
};

const defaultDestinationDraft: DestinationDraft = {
  destination_key: "local-export",
  display_name: "Local Export",
  destination_type: "local_file_test",
  mode: "test",
  enabled: true,
  configJson: JSON.stringify({ base_dir: "/tmp/flowforge-exports" }, null, 2),
};

const parseConfig = (value: string) => {
  const parsed = JSON.parse(value || "{}");
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Config must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
};

function SourceList({
  sources,
  pendingKey,
  onEdit,
  onTest,
  onToggle,
}: {
  sources: FlowForgeDataSource[];
  pendingKey?: string | null;
  onEdit: (source: FlowForgeDataSource) => void;
  onTest: (source: FlowForgeDataSource) => void;
  onToggle: (source: FlowForgeDataSource) => void;
}) {
  return (
    <div className="ff-admin-list">
      {sources.map((source) => (
        <article className="ff-admin-card" key={source.source_key}>
          <div>
            <strong>{source.display_name}</strong>
            <p>
              {source.source_key} - {source.source_type} - {source.mode}
            </p>
          </div>
          <StatusBadge status={source.enabled ? "enabled" : "disabled"} />
          <div className="ff-data-movement-actions">
            <button type="button" className="btn btn-outline-secondary" onClick={() => onEdit(source)}>
              Edit
            </button>
            <button type="button" className="btn btn-outline-secondary" disabled={pendingKey === source.source_key} onClick={() => onTest(source)}>
              Test
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => onToggle(source)}>
              {source.enabled ? "Disable" : "Enable"}
            </button>
          </div>
        </article>
      ))}
      {!sources.length ? <div className="ff-empty-state">No data sources configured.</div> : null}
    </div>
  );
}

function DestinationList({
  destinations,
  pendingKey,
  onEdit,
  onTest,
  onToggle,
}: {
  destinations: FlowForgeDataDestination[];
  pendingKey?: string | null;
  onEdit: (destination: FlowForgeDataDestination) => void;
  onTest: (destination: FlowForgeDataDestination) => void;
  onToggle: (destination: FlowForgeDataDestination) => void;
}) {
  return (
    <div className="ff-admin-list">
      {destinations.map((destination) => (
        <article className="ff-admin-card" key={destination.destination_key}>
          <div>
            <strong>{destination.display_name}</strong>
            <p>
              {destination.destination_key} - {destination.destination_type} - {destination.mode}
            </p>
          </div>
          <StatusBadge status={destination.enabled ? "enabled" : "disabled"} />
          <div className="ff-data-movement-actions">
            <button type="button" className="btn btn-outline-secondary" onClick={() => onEdit(destination)}>
              Edit
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={pendingKey === destination.destination_key}
              onClick={() => onTest(destination)}
            >
              Test
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => onToggle(destination)}>
              {destination.enabled ? "Disable" : "Enable"}
            </button>
          </div>
        </article>
      ))}
      {!destinations.length ? <div className="ff-empty-state">No data destinations configured.</div> : null}
    </div>
  );
}

export default function FlowForgeDataMovementPage() {
  const queryClient = useQueryClient();
  const [sourceDraft, setSourceDraft] = useState<SourceDraft>(defaultSourceDraft);
  const [destinationDraft, setDestinationDraft] = useState<DestinationDraft>(defaultDestinationDraft);
  const [message, setMessage] = useState<string | null>(null);
  const sourcesQuery = useQuery({
    queryKey: ["flowforge", "data-movement", "sources"],
    queryFn: listFlowForgeDataSources,
  });
  const destinationsQuery = useQuery({
    queryKey: ["flowforge", "data-movement", "destinations"],
    queryFn: listFlowForgeDataDestinations,
  });
  const saveSourceMutation = useMutation({
    mutationFn: () =>
      upsertFlowForgeDataSource({
        source_key: sourceDraft.source_key.trim(),
        display_name: sourceDraft.display_name.trim(),
        source_type: sourceDraft.source_type,
        mode: sourceDraft.mode,
        enabled: sourceDraft.enabled,
        config: parseConfig(sourceDraft.configJson),
      }),
    onSuccess: async () => {
      setMessage("Data source saved.");
      await queryClient.invalidateQueries({ queryKey: ["flowforge", "data-movement", "sources"] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Unable to save data source."),
  });
  const saveDestinationMutation = useMutation({
    mutationFn: () =>
      upsertFlowForgeDataDestination({
        destination_key: destinationDraft.destination_key.trim(),
        display_name: destinationDraft.display_name.trim(),
        destination_type: destinationDraft.destination_type,
        mode: destinationDraft.mode,
        enabled: destinationDraft.enabled,
        config: parseConfig(destinationDraft.configJson),
      }),
    onSuccess: async () => {
      setMessage("Data destination saved.");
      await queryClient.invalidateQueries({ queryKey: ["flowforge", "data-movement", "destinations"] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Unable to save data destination."),
  });
  const toggleSourceMutation = useMutation({
    mutationFn: (source: FlowForgeDataSource) => updateFlowForgeDataSource(source.source_key, { enabled: !source.enabled }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["flowforge", "data-movement", "sources"] }),
  });
  const toggleDestinationMutation = useMutation({
    mutationFn: (destination: FlowForgeDataDestination) =>
      updateFlowForgeDataDestination(destination.destination_key, { enabled: !destination.enabled }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["flowforge", "data-movement", "destinations"] }),
  });
  const testSourceMutation = useMutation({
    mutationFn: (sourceKey: string) => testFlowForgeDataSource(sourceKey),
    onSuccess: (result) => setMessage(result.message),
    onError: (error) => setMessage(error instanceof Error ? error.message : "Unable to test data source."),
  });
  const testDestinationMutation = useMutation({
    mutationFn: (destinationKey: string) => testFlowForgeDataDestination(destinationKey),
    onSuccess: (result) => setMessage(result.message),
    onError: (error) => setMessage(error instanceof Error ? error.message : "Unable to test data destination."),
  });

  return (
    <main className="ff-page">
      <FlowForgePageHeader
        title="Data Movement"
        description="Configure allowlisted sources and destinations, then review dataset artifacts, validation failures, and movement audit."
      />

      {message ? <div className="ff-runtime-panel ff-data-movement-message">{message}</div> : null}

      <div className="ff-runtime-grid">
        <section className="ff-runtime-panel">
          <h2>Sources</h2>
          <form
            className="ff-admin-form ff-data-movement-form"
            onSubmit={(event) => {
              event.preventDefault();
              saveSourceMutation.mutate();
            }}
          >
            <label>
              Source Key
              <input value={sourceDraft.source_key} onChange={(event) => setSourceDraft({ ...sourceDraft, source_key: event.target.value })} />
            </label>
            <label>
              Display Name
              <input value={sourceDraft.display_name} onChange={(event) => setSourceDraft({ ...sourceDraft, display_name: event.target.value })} />
            </label>
            <label>
              Source Type
              <select value={sourceDraft.source_type} onChange={(event) => setSourceDraft({ ...sourceDraft, source_type: event.target.value })}>
                <option value="local_file_test">local_file_test</option>
                <option value="sftp">sftp</option>
                <option value="api">api</option>
                <option value="webhook">webhook</option>
                <option value="jotform">jotform</option>
              </select>
            </label>
            <label>
              Mode
              <select value={sourceDraft.mode} onChange={(event) => setSourceDraft({ ...sourceDraft, mode: event.target.value })}>
                <option value="test">test</option>
                <option value="production">production</option>
              </select>
            </label>
            <label className="ff-settings-toggle-row">
              Enabled
              <input
                type="checkbox"
                checked={sourceDraft.enabled}
                onChange={(event) => setSourceDraft({ ...sourceDraft, enabled: event.target.checked })}
              />
            </label>
            <label>
              Config JSON
              <textarea value={sourceDraft.configJson} onChange={(event) => setSourceDraft({ ...sourceDraft, configJson: event.target.value })} />
            </label>
            <button type="submit" className="btn btn-primary" disabled={saveSourceMutation.isPending}>
              Save Source
            </button>
          </form>
          <SourceList
            sources={sourcesQuery.data ?? []}
            pendingKey={testSourceMutation.variables}
            onEdit={(source) =>
              setSourceDraft({
                source_key: source.source_key,
                display_name: source.display_name,
                source_type: source.source_type,
                mode: source.mode,
                enabled: source.enabled,
                configJson: JSON.stringify(source.config ?? {}, null, 2),
              })
            }
            onTest={(source) => testSourceMutation.mutate(source.source_key)}
            onToggle={(source) => toggleSourceMutation.mutate(source)}
          />
        </section>

        <section className="ff-runtime-panel">
          <h2>Destinations</h2>
          <form
            className="ff-admin-form ff-data-movement-form"
            onSubmit={(event) => {
              event.preventDefault();
              saveDestinationMutation.mutate();
            }}
          >
            <label>
              Destination Key
              <input
                value={destinationDraft.destination_key}
                onChange={(event) => setDestinationDraft({ ...destinationDraft, destination_key: event.target.value })}
              />
            </label>
            <label>
              Display Name
              <input
                value={destinationDraft.display_name}
                onChange={(event) => setDestinationDraft({ ...destinationDraft, display_name: event.target.value })}
              />
            </label>
            <label>
              Destination Type
              <select
                value={destinationDraft.destination_type}
                onChange={(event) => setDestinationDraft({ ...destinationDraft, destination_type: event.target.value })}
              >
                <option value="local_file_test">local_file_test</option>
                <option value="sftp">sftp</option>
                <option value="s3_compatible">s3_compatible</option>
                <option value="api">api</option>
                <option value="email">email</option>
              </select>
            </label>
            <label>
              Mode
              <select value={destinationDraft.mode} onChange={(event) => setDestinationDraft({ ...destinationDraft, mode: event.target.value })}>
                <option value="test">test</option>
                <option value="production">production</option>
              </select>
            </label>
            <label className="ff-settings-toggle-row">
              Enabled
              <input
                type="checkbox"
                checked={destinationDraft.enabled}
                onChange={(event) => setDestinationDraft({ ...destinationDraft, enabled: event.target.checked })}
              />
            </label>
            <label>
              Config JSON
              <textarea
                value={destinationDraft.configJson}
                onChange={(event) => setDestinationDraft({ ...destinationDraft, configJson: event.target.value })}
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={saveDestinationMutation.isPending}>
              Save Destination
            </button>
          </form>
          <DestinationList
            destinations={destinationsQuery.data ?? []}
            pendingKey={testDestinationMutation.variables}
            onEdit={(destination) =>
              setDestinationDraft({
                destination_key: destination.destination_key,
                display_name: destination.display_name,
                destination_type: destination.destination_type,
                mode: destination.mode,
                enabled: destination.enabled,
                configJson: JSON.stringify(destination.config ?? {}, null, 2),
              })
            }
            onTest={(destination) => testDestinationMutation.mutate(destination.destination_key)}
            onToggle={(destination) => toggleDestinationMutation.mutate(destination)}
          />
        </section>
      </div>

      <DataMovementReviewPanels limit={100} />
    </main>
  );
}
