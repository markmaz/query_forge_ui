import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useAppSelector } from "../../../shared/runtime/hooks";
import {
  plannerResultToPlannerResponse,
  plannerRequestSchema,
  runSemanticPlanner,
  suggestSemanticColumns,
  testPlannerExtraction,
  type PlannerEngine,
  type PlannerResult,
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
const PLANNER_ENGINE_STORAGE_KEY = "semanticPlanner.engine";

const ENGINE_LABELS: Record<PlannerEngine, string> = {
  legacy: "Legacy (semantic/plan)",
  llm_v2: "LLM v2 (planner/plan_llm)",
};

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

function loadPersistedEngine(): PlannerEngine {
  if (typeof window === "undefined") return "legacy";
  try {
    const persisted = window.localStorage.getItem(PLANNER_ENGINE_STORAGE_KEY);
    return persisted === "llm_v2" ? "llm_v2" : "legacy";
  } catch {
    return "legacy";
  }
}

function persistEngine(value: PlannerEngine): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PLANNER_ENGINE_STORAGE_KEY, value);
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
  const [plannerRunResult, setPlannerRunResult] = useState<PlannerResult | null>(null);
  const [extractSpacy, setExtractSpacy] = useState<SpacyExtraction | null>(null);
  const [action, setAction] = useState<PlannerAction>("plan");
  const [engine, setEngine] = useState<PlannerEngine>(() => loadPersistedEngine());

  const form = useForm<PlannerRequest>({
    resolver: zodResolver(plannerRequestSchema),
    defaultValues: {
      workspace_id: String(workspaceId || ""),
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

  useEffect(() => {
    persistEngine(engine);
  }, [engine]);

  const plannerM = useMutation({
    mutationFn: async (payload: { action: PlannerAction; request: PlannerRequest }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (payload.action === "suggest") {
        return {
          response: await suggestSemanticColumns(payload.request, { signal: controller.signal }),
          runResult: null as PlannerResult | null,
        };
      }
      const runResult = await runSemanticPlanner(
        {
          engine,
          workspaceId: payload.request.workspace_id,
          prompt: payload.request.prompt,
          domainId: payload.request.domain_id,
          debug: payload.request.debug ?? false,
          maxConcepts: payload.request.max_concepts,
          maxColumns: payload.request.max_columns,
        },
        { signal: controller.signal }
      );

      return {
        response: plannerResultToPlannerResponse(runResult, payload.request.prompt),
        runResult,
      };
    },
    onSuccess: (data) => {
      setResult(data.response);
      setPlannerRunResult(data.runResult);
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
    setPlannerRunResult(null);
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
    setPlannerRunResult(null);
    setExtractSpacy(null);
    await extractM.mutateAsync(request.prompt);
  }

  const plannerSummary = useMemo(() => {
    if (!result) return null;
    return {
      explanation: result.explanation ?? "No explanation provided.",
      confidence: typeof result.confidence === "number" ? `${Math.round(result.confidence * 100)}%` : "-",
      engine: ENGINE_LABELS[plannerRunResult?.engine ?? engine],
      traceId: plannerRunResult?.traceId,
      attempts:
        result.debug && "attempts" in result.debug
          ? String((result.debug as Record<string, unknown>).attempts ?? "-")
          : "-",
    };
  }, [engine, plannerRunResult, result]);

  const debugPayload = useMemo(() => {
    if (!result) return null;
    const payload: Record<string, unknown> = {
      planner_engine: plannerRunResult?.engine ?? engine,
      planner_engine_label: ENGINE_LABELS[plannerRunResult?.engine ?? engine],
      debug: result.debug,
    };
    if (plannerRunResult?.traceId) payload.trace_id = plannerRunResult.traceId;
    if (plannerRunResult?.validation) payload.validation = plannerRunResult.validation;
    if (plannerRunResult?.candidates) payload.candidates = plannerRunResult.candidates;
    if (plannerRunResult?.timingsMs) payload.timings_ms = plannerRunResult.timingsMs;
    return payload;
  }, [engine, plannerRunResult, result]);

  function copyResponseJson() {
    const payload = result
      ? {
          planner_engine: plannerRunResult?.engine ?? engine,
          planner_engine_label: ENGINE_LABELS[plannerRunResult?.engine ?? engine],
          trace_id: plannerRunResult?.traceId,
          result,
        }
      : extractSpacy
        ? { spacy: extractSpacy }
        : null;
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
            <FormField label="Planner Engine">
              <select
                className="form-select"
                value={engine}
                onChange={(event) => setEngine(event.target.value === "llm_v2" ? "llm_v2" : "legacy")}
                disabled={busy}
              >
                <option value="legacy">Legacy (semantic/plan)</option>
                <option value="llm_v2">LLM v2 (planner/plan_llm)</option>
              </select>
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
                  Engine: <strong>{plannerSummary?.engine}</strong>
                </span>
                <span className="small text-muted">
                  Attempts: <strong>{plannerSummary?.attempts}</strong>
                </span>
                {plannerSummary?.traceId ? (
                  <span className="small text-muted">
                    Trace: <strong>{plannerSummary.traceId}</strong>
                  </span>
                ) : null}
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
            result ? <JsonViewer value={debugPayload ?? result.debug} /> : <div className="text-muted small">No debug output.</div>
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
