import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useAppSelector } from "../../../shared/lib/hooks";
import {
  generateSemanticPlan,
  plannerRequestSchema,
  suggestSemanticColumns,
  testPlannerExtraction,
  type SpacyExtraction,
  type PlannerRequest,
  type PlannerResponse,
} from "../../../shared/services/semantic";
import ApiErrorBanner from "./components/ApiErrorBanner";
import FormField from "./components/FormField";
import JsonViewer from "./components/JsonViewer";
import LoadingSkeleton from "./components/LoadingSkeleton";
import SemanticAdminShell from "./components/SemanticAdminShell";
import SpacyExtractionPanel from "./components/SpacyExtractionPanel";
import SemanticToast from "./components/Toast";
import "./styles/semanticAdmin.css";

type PlannerAction = "suggest" | "plan";
type PlannerTab =
  | "deterministic"
  | "conceptVector"
  | "conceptMapping"
  | "columnVector"
  | "llmPlan"
  | "debug"
  | "spacy"
  | "raw";
const PLANNER_PROMPT_STORAGE_KEY = "semantic-admin:planner:prompt";

function loadPersistedPrompt(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(PLANNER_PROMPT_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function persistPrompt(value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PLANNER_PROMPT_STORAGE_KEY, value);
  } catch {
    // ignore storage write errors in restricted contexts
  }
}

const tabs: { key: PlannerTab; label: string }[] = [
  { key: "deterministic", label: "Deterministic" },
  { key: "conceptVector", label: "Concept Vector Hits" },
  { key: "conceptMapping", label: "Concept Mapping" },
  { key: "columnVector", label: "Constrained Column Vector" },
  { key: "llmPlan", label: "LLM Plan" },
  { key: "debug", label: "Debug Timings" },
  { key: "spacy", label: "spaCy Extraction" },
  { key: "raw", label: "Raw JSON" },
];

export function PlannerPage() {
  const workspaceId = useAppSelector((state) => state.userWorkspaces.selectedWorkspaceId ?? "");
  const [initialPrompt] = useState(() => loadPersistedPrompt());
  const abortRef = useRef<AbortController | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [tab, setTab] = useState<PlannerTab>("deterministic");
  const [result, setResult] = useState<PlannerResponse | null>(null);
  const [extractSpacy, setExtractSpacy] = useState<SpacyExtraction | null>(null);
  const [action, setAction] = useState<PlannerAction>("plan");

  const form = useForm<PlannerRequest>({
    resolver: zodResolver(plannerRequestSchema),
    defaultValues: {
      workspace_id: String(workspaceId || ""),
      vertical_norm: "",
      prompt: initialPrompt,
      domain_id: undefined,
      max_concepts: 25,
      max_columns: 50,
      debug: false,
    },
  });

  useEffect(() => {
    form.setValue("workspace_id", String(workspaceId || ""));
  }, [form, workspaceId]);

  const promptValue = form.watch("prompt");
  useEffect(() => {
    persistPrompt(promptValue ?? "");
  }, [promptValue]);

  const plannerM = useMutation({
    mutationFn: async (payload: { action: PlannerAction; request: PlannerRequest }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (payload.action === "suggest") {
        return suggestSemanticColumns(payload.request, { signal: controller.signal });
      }
      return generateSemanticPlan(payload.request, { signal: controller.signal });
    },
    onSuccess: (data) => {
      setResult(data);
      setApiError(null);
    },
    onError: (error: Error & { name?: string; message: string }) => {
      if (error.name === "CanceledError" || error.message.toLowerCase().includes("canceled")) {
        return;
      }
      setApiError(error.message || "Unable to execute planner request.");
    },
    onSettled: () => {
      abortRef.current = null;
    },
  });

  const extractM = useMutation({
    mutationFn: async (prompt: string) => testPlannerExtraction({ prompt }),
    onSuccess: (spacy) => {
      setExtractSpacy(spacy);
      setResult(null);
      setTab("spacy");
      setApiError(null);
    },
    onError: (error: Error) => {
      setApiError(error.message || "Unable to run extraction test.");
    },
  });

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function runPlanner(nextAction: PlannerAction) {
    setAction(nextAction);
    setApiError(null);
    setResult(null);
    setExtractSpacy(null);
    const request = await form.trigger().then((valid) => {
      if (!valid) return null;
      return form.getValues();
    });
    if (!request) return;

    await plannerM.mutateAsync({ action: nextAction, request });
  }

  async function runExtractionTest() {
    const validPrompt = await form.trigger("prompt");
    if (!validPrompt) return;
    const request = form.getValues();
    setApiError(null);
    setResult(null);
    setExtractSpacy(null);
    await extractM.mutateAsync(request.prompt);
  }

  const plannerSummary = useMemo(() => {
    if (!result) return null;
    return {
      explanation: result.explanation ?? "No explanation provided.",
      confidence: typeof result.confidence === "number" ? `${Math.round(result.confidence * 100)}%` : "-",
      attempts:
        result.debug && "attempts" in result.debug
          ? String((result.debug as Record<string, unknown>).attempts ?? "-")
          : "-",
    };
  }, [result]);

  function copyResponseJson() {
    const payload = result ? result : extractSpacy ? { spacy: extractSpacy } : null;
    if (!payload) return;
    void navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    SemanticToast.success("Planner response copied.");
  }

  const detailsAvailable = Boolean(result || extractSpacy);
  const activeSpacy = extractSpacy ?? result?.spacy ?? null;
  const busy = plannerM.isPending || extractM.isPending;

  return (
    <SemanticAdminShell title="Semantic Planner" subtitle="Evaluate deterministic/vector matching and inspect SQL planning output.">
      <ApiErrorBanner message={apiError} onDismiss={() => setApiError(null)} />

      <div className="semantic-admin-card p-3 mb-3">
        <form className="row g-3" onSubmit={(event) => event.preventDefault()}>
          <div className="col-12">
            <FormField label="Prompt" error={form.formState.errors.prompt?.message}>
              <textarea
                className="form-control"
                rows={4}
                placeholder="Find top active students by district over the last 30 days"
                {...form.register("prompt")}
              />
            </FormField>
          </div>

          <div className="col-md-4">
            <FormField label="Workspace ID" error={form.formState.errors.workspace_id?.message}>
              <input className="form-control" {...form.register("workspace_id")} />
            </FormField>
          </div>

          <div className="col-md-4">
            <FormField label="Vertical">
              <input className="form-control" placeholder="education" {...form.register("vertical_norm")} />
            </FormField>
          </div>

          <div className="col-md-4">
            <FormField label="Domain ID">
              <input
                type="number"
                className="form-control"
                {...form.register("domain_id", {
                  setValueAs: (value) => (value === "" ? undefined : Number(value)),
                })}
              />
            </FormField>
          </div>

          <div className="col-md-4">
            <FormField label="Max Concepts">
              <input type="number" className="form-control" {...form.register("max_concepts", { valueAsNumber: true })} />
            </FormField>
          </div>

          <div className="col-md-4">
            <FormField label="Max Columns">
              <input type="number" className="form-control" {...form.register("max_columns", { valueAsNumber: true })} />
            </FormField>
          </div>

          <div className="col-md-4 d-flex align-items-end">
            <div className="form-check mb-2">
              <input id="semantic-debug" type="checkbox" className="form-check-input" {...form.register("debug")} />
              <label htmlFor="semantic-debug" className="form-check-label">
                Include debug output
              </label>
            </div>
          </div>

          <div className="col-12 d-flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-outline-dark btn-sm"
              disabled={busy}
              onClick={() => runPlanner("suggest")}
            >
              {plannerM.isPending && action === "suggest" ? "Suggesting..." : "Suggest Columns"}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy}
              onClick={() => runPlanner("plan")}
            >
              {plannerM.isPending && action === "plan" ? "Generating..." : "Generate Plan"}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              disabled={busy}
              onClick={() => {
                void runExtractionTest();
              }}
            >
              {extractM.isPending ? "Extracting..." : "Test Extraction"}
            </button>
            {plannerM.isPending ? (
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={() => {
                  abortRef.current?.abort();
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </div>

      {busy ? <LoadingSkeleton lines={6} /> : null}

      {detailsAvailable ? (
        <div className="semantic-admin-card p-3">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            {result ? (
              <div className="d-flex gap-3 flex-wrap">
                <span className="small text-muted">
                  Confidence: <strong>{plannerSummary?.confidence}</strong>
                </span>
                <span className="small text-muted">
                  Attempts: <strong>{plannerSummary?.attempts}</strong>
                </span>
              </div>
            ) : (
              <span className="small text-muted">Extraction test result</span>
            )}
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={copyResponseJson}>
              Copy JSON
            </button>
          </div>

          {result ? <div className="alert alert-light border mb-3">{plannerSummary?.explanation}</div> : null}

          <div className="semantic-admin-tab-list mb-3">
            {tabs.map((entry) => (
              <button
                key={entry.key}
                type="button"
                className={`semantic-admin-tab-btn${tab === entry.key ? " active" : ""}`}
                onClick={() => setTab(entry.key)}
              >
                {entry.label}
              </button>
            ))}
          </div>

          {tab === "deterministic" ? (
            result ? (
              <div>
                <h6>Matched Tokens</h6>
                <ul className="mb-3">
                  {result.deterministic.matched.map((match) => (
                    <li key={`${match.token}-${match.concept_key}`}>
                      <strong>{match.token}</strong> → {match.concept_key} ({Math.round(match.confidence * 100)}%) {match.reason}
                    </li>
                  ))}
                </ul>
                <h6>Unmatched Tokens</h6>
                <div className="text-muted small">
                  {result.deterministic.unmatched_tokens.length > 0
                    ? result.deterministic.unmatched_tokens.join(", ")
                    : "None"}
                </div>
              </div>
            ) : (
              <div className="text-muted small">Run Suggest Columns or Generate Plan to view deterministic output.</div>
            )
          ) : null}

          {tab === "conceptVector" ? (
            result ? <JsonViewer value={result.concept_vector} /> : <div className="text-muted small">No concept vector output.</div>
          ) : null}

          {tab === "conceptMapping" ? (
            result ? <JsonViewer value={result.concept_mapping} /> : <div className="text-muted small">No concept mapping output.</div>
          ) : null}

          {tab === "columnVector" ? (
            result ? <JsonViewer value={result.column_vector} /> : <div className="text-muted small">No column vector output.</div>
          ) : null}

          {tab === "llmPlan" ? (
            result?.llm_plan ? (
              <div className="d-flex flex-column gap-3">
                <div>
                  <h6>SQL JSON</h6>
                  <JsonViewer value={result.llm_plan?.sql_json} />
                </div>
                <div>
                  <h6>Join Plan</h6>
                  <JsonViewer value={result.llm_plan?.join_plan} />
                </div>
              </div>
            ) : (
              <div className="text-muted small">No LLM plan returned.</div>
            )
          ) : null}

          {tab === "debug" ? (
            result ? <JsonViewer value={result.debug} /> : <div className="text-muted small">No debug output.</div>
          ) : null}

          {tab === "spacy" ? (
            <SpacyExtractionPanel spacy={activeSpacy} />
          ) : null}

          {tab === "raw" ? (
            <JsonViewer value={result ?? { spacy: extractSpacy }} />
          ) : null}
        </div>
      ) : null}
    </SemanticAdminShell>
  );
}

export default PlannerPage;
