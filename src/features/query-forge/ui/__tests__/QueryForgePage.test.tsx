/**
 * QueryForgePage integration tests
 *
 * Run:
 *   npx vitest run src/features/query-forge/ui/QueryForgePage.test.tsx
 *
 * Fixture map:
 * - /domains -> src/test/fixtures/queryForge/domains.json
 * - /domains/summary -> src/test/fixtures/queryForge/domainSummaries.json
 * - /domains/columns -> src/test/fixtures/queryForge/domainColumns.json
 * - /executions/start -> src/test/fixtures/queryForge/executionStart.json
 * - /executions/:jobId/results -> src/test/fixtures/queryForge/executionResults*.json
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, delay } from "msw";

import { renderQueryForgePage } from "../../../../test/utils/renderQueryForgePage";
import { server } from "../../../../test/msw/server";
import {
  getLastExecutionStartPayload,
  resetExecutionTracking,
  resetJoinStore,
  resetLastQueryPayload,
} from "../../../../test/msw/handlers";
import domainsFixture from "../../../../test/fixtures/queryForge/domains.json";
import executionResultsEmptyFixture from "../../../../test/fixtures/queryForge/executionResultsEmpty.json";

const API_BASE = "";

async function openTool(user: ReturnType<typeof userEvent.setup>, name: string) {
  const toolButton = screen.getByRole("button", { name: new RegExp(`^${name}$`, "i") });
  if (toolButton.getAttribute("aria-pressed") === "true") return;
  await user.click(toolButton);
}

async function selectDomain(user: ReturnType<typeof userEvent.setup>) {
  await openTool(user, "Domain");
  const domainRow = await screen.findByRole("button", { name: /patient domain/i });
  await user.click(domainRow);
}

async function selectColumn(user: ReturnType<typeof userEvent.setup>, columnName = "patient_id") {
  await openTool(user, "Columns");
  const checkbox = await screen.findByRole("checkbox", {
    name: new RegExp(`toggle ${columnName}`, "i"),
  });
  await user.click(checkbox);
}

async function buildMinimalQuery(user: ReturnType<typeof userEvent.setup>) {
  await selectDomain(user);
  await selectColumn(user);

  await waitFor(() => {
    expect(screen.getByRole("button", { name: /run preview/i })).toBeEnabled();
  });
}

function collectFilterConditions(node: any): Array<{ op: string; value: unknown }> {
  if (!node || typeof node !== "object") return [];
  if (node.type === "condition") {
    return [{ op: String(node.op ?? ""), value: node.value }];
  }
  if (!Array.isArray(node.children)) return [];
  return node.children.flatMap((child: any) => collectFilterConditions(child));
}

beforeAll(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetLastQueryPayload();
  resetExecutionTracking();
  resetJoinStore();
  window.localStorage.clear();
});

afterAll(() => {
  vi.restoreAllMocks();
  server.close();
});

describe("QueryForgePage", () => {
  it("renders smoke UI with primary builder controls", async () => {
    renderQueryForgePage();

    expect(screen.getByText("Query Studio")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^domain$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^columns$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^filters$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run preview/i })).toBeDisabled();
    expect(screen.getByText("Missing Domain")).toBeInTheDocument();

    const user = userEvent.setup();
    await openTool(user, "Domain");
    expect(await screen.findByText("Choose a domain table. Optionally join cohorts/value overrides.")).toBeInTheDocument();
  });

  it("shows loading state then renders domain options on initial load", async () => {
    server.use(
      http.get(`${API_BASE}/domains`, async () => {
        await delay(250);
        return HttpResponse.json(domainsFixture);
      })
    );

    renderQueryForgePage();
    const user = userEvent.setup();

    await openTool(user, "Domain");
    expect(await screen.findByText("Loading domains…")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /patient domain/i })).toBeInTheDocument();
    expect(screen.getByText(/patient_origins, source_codes/i)).toBeInTheDocument();
  });

  it("renders initial load error when domains request fails", async () => {
    server.use(
      http.get(`${API_BASE}/domains`, () => {
        return HttpResponse.json({ message: "upstream failure" }, { status: 500 });
      })
    );

    renderQueryForgePage();
    const user = userEvent.setup();

    await openTool(user, "Domain");
    expect(await screen.findByText(/request failed with status code 500/i)).toBeInTheDocument();
  });

  it("allows user to build a minimal query via domain, columns, and filters", async () => {
    renderQueryForgePage();
    const user = userEvent.setup();

    await buildMinimalQuery(user);

    expect(screen.getByText(/selected columns/i)).toBeInTheDocument();

    await openTool(user, "Filters");
    await user.click(await screen.findByRole("button", { name: /add filter/i }));
    await user.type(await screen.findByPlaceholderText("Value"), "P-100");

    await waitFor(() => {
      expect(screen.getByText(/\(patient_id = "P-100"\)/)).toBeInTheDocument();
    });
  });

  it("serializes not_in + is_null + gte filters in preview payload", async () => {
    renderQueryForgePage();
    const user = userEvent.setup();

    await buildMinimalQuery(user);
    await openTool(user, "Filters");
    await user.click(await screen.findByRole("button", { name: /add filter/i }));

    const getOperatorSelects = () =>
      screen
        .getAllByRole("combobox")
        .map((element) => element as HTMLSelectElement)
        .filter((select) => Array.from(select.options).some((option) => option.value === "not_in"));

    await user.selectOptions(getOperatorSelects()[0]!, "not_in");
    await user.type(screen.getByPlaceholderText(/enter value and press enter/i), "CA{enter}TX{enter}");

    await user.click(screen.getByRole("button", { name: /\+ condition/i }));
    await user.click(screen.getByRole("button", { name: /\+ condition/i }));

    await waitFor(() => {
      expect(getOperatorSelects().length).toBe(3);
    });

    const operatorSelects = getOperatorSelects();
    await user.selectOptions(operatorSelects[1]!, "is_null");
    await user.selectOptions(operatorSelects[2]!, "gte");

    const valueInputs = screen.getAllByPlaceholderText("Value");
    const gteInput = valueInputs[valueInputs.length - 1];
    await user.clear(gteInput);
    await user.type(gteInput, "21");

    await user.click(screen.getByRole("button", { name: /run preview/i }));

    await waitFor(() => {
      const payload = getLastExecutionStartPayload();
      const conditions = collectFilterConditions(payload?.sqlJson?.filters);
      const notIn = conditions.find((item) => item.op === "not_in");
      const isNull = conditions.find((item) => item.op === "is_null");
      const gte = conditions.find((item) => item.op === "gte");
      expect(notIn?.value).toEqual(["CA", "TX"]);
      expect(isNull?.value).toBeNull();
      expect(gte?.value).toBe("21");
    });
  });

  it("renders Exclude Error Rows toggle ON by default", async () => {
    renderQueryForgePage();
    const user = userEvent.setup();

    await openTool(user, "Domain");

    expect(screen.getByLabelText(/exclude error rows/i)).toBeChecked();
  });

  it("includes meta.apply_tdoe_severity_filter=false when Exclude Error Rows is OFF", async () => {
    renderQueryForgePage();
    const user = userEvent.setup();

    await buildMinimalQuery(user);
    await openTool(user, "Domain");

    const toggle = screen.getByLabelText(/exclude error rows/i);
    expect(toggle).toBeChecked();
    await user.click(toggle);
    expect(toggle).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: /run preview/i }));

    await waitFor(() => {
      const payload = getLastExecutionStartPayload();
      expect(payload?.sqlJson?.meta?.apply_tdoe_severity_filter).toBe(false);
      expect(payload?.sqlJson?.meta).not.toHaveProperty("include_error_rows");
    });
  });

  it("omits meta.apply_tdoe_severity_filter when Exclude Error Rows is ON", async () => {
    renderQueryForgePage();
    const user = userEvent.setup();

    await buildMinimalQuery(user);
    await user.click(screen.getByRole("button", { name: /run preview/i }));

    await waitFor(() => {
      const payload = getLastExecutionStartPayload();
      expect(payload?.sqlJson?.meta?.apply_tdoe_severity_filter).toBeUndefined();
      expect(payload?.sqlJson?.meta).not.toHaveProperty("include_error_rows");
    });
  });

  it("hydrates selected columns from AI-applied snake_case sqlJson payload", async () => {
    server.use(
      http.post("*/api/v1/planner/plan_domain", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.vertical_norm).toBe("education");
        return HttpResponse.json({
          plan_json_v2: {
            schema_version: 2,
            trace_id: "trace-cols-1",
            workspace_id: "ws-test",
            vertical_norm: "education",
            base_domain_id: 1,
            domain_name: "Patient Domain",
            intent: "list",
            selects: { dimensions: [], metrics: [] },
            filters: [],
            time: null,
            grouping: null,
            debug: null,
          },
          sql_json: {
            version: 1,
            domain_id: 1,
            columns: [
              {
                model_column_id: 101,
                workspace_table_id: 10,
                column_name: "patient_id",
              },
            ],
          },
          validation: { is_valid: true, errors: [], repairs_applied: [] },
          explanation: {
            summary: "Selected enrollment fields for your request.",
            summary_source: "llm",
            domain: {
              selected_domain_name: "Patient Domain",
              reason: "Contains requested attributes.",
            },
            dimensions: [],
            metrics: [],
            filters: [],
          },
          trace_id: "trace-cols-1",
          debug: { model: "gpt-test", attempts: 1 },
        });
      })
    );

    renderQueryForgePage();
    const user = userEvent.setup();

    await selectDomain(user);
    await openTool(user, "Columns");

    await user.click(screen.getByRole("button", { name: /ask queryforge ai/i }));
    await user.type(screen.getByLabelText(/^goal$/i), "Select patient id");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    await screen.findByRole("button", { name: /apply changes/i });
    await user.click(screen.getByRole("button", { name: /apply changes/i }));

    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: /toggle patient_id/i })).toBeChecked();
    });
  });

  it("hydrates selected columns from AI-applied wrapped field sqlJson payload", async () => {
    server.use(
      http.post("*/api/v1/planner/plan_domain", async () =>
        HttpResponse.json({
          plan_json_v2: {
            schema_version: 2,
            trace_id: "trace-cols-2",
            workspace_id: "ws-test",
            vertical_norm: "education",
            base_domain_id: 1,
            domain_name: "Patient Domain",
            intent: "list",
            selects: { dimensions: [], metrics: [] },
            filters: [],
            time: null,
            grouping: null,
            debug: null,
          },
          sql_json: {
            version: 1,
            domainId: 1,
            columns: [
              {
                field: {
                  modelColumnId: 101,
                  columnName: "patient_id",
                  workspaceTableId: 10,
                  exprId: null,
                  alias: null,
                },
                alias: null,
              },
              {
                field: {
                  modelColumnId: 102,
                  columnName: "patient_gender",
                  workspaceTableId: 10,
                  exprId: null,
                  alias: null,
                },
                alias: null,
              },
            ],
            filters: {
              type: "group",
              id: "semantic_plan_filters",
              match: "and",
              children: [
                {
                  type: "condition",
                  id: "semantic_plan_filter_1",
                  field: {
                    modelColumnId: 102,
                    columnName: "patient_gender",
                    workspaceTableId: 10,
                    exprId: null,
                    alias: null,
                  },
                  op: "not_equals",
                  value: "UNKNOWN",
                },
              ],
            },
          },
          validation: { is_valid: true, errors: [], repairs_applied: [] },
          explanation: {
            summary: "Prepared the selected columns from planner output.",
            summary_source: "deterministic",
            domain: {
              selected_domain_name: "Patient Domain",
              reason: "Contains requested attributes.",
            },
            dimensions: [],
            metrics: [],
            filters: [],
          },
          trace_id: "trace-cols-2",
          debug: { model: "qwen25-14b", attempts: 1 },
        })
      )
    );

    renderQueryForgePage();
    const user = userEvent.setup();

    await selectDomain(user);
    await openTool(user, "Columns");

    await user.click(screen.getByRole("button", { name: /ask queryforge ai/i }));
    await user.type(screen.getByLabelText(/^goal$/i), "Show me patient ids and gender");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    await screen.findByRole("button", { name: /apply changes/i });
    await user.click(screen.getByRole("button", { name: /apply changes/i }));

    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: /toggle patient_id/i })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: /toggle patient_gender/i })).toBeChecked();
    });
  });

  it("hydrates filters from AI-applied plan_domain sql_json payload", async () => {
    server.use(
      http.post("*/api/v1/planner/plan_domain", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body).not.toHaveProperty("workspace_id");
        expect(body.vertical_norm).toBe("education");

        return HttpResponse.json({
          plan_json_v2: {
            schema_version: 2,
            trace_id: "trace-filter-1",
            workspace_id: "ws-test",
            vertical_norm: "education",
            base_domain_id: 1,
            domain_name: "Patient Domain",
            intent: "list",
            selects: { dimensions: [], metrics: [] },
            filters: [
              {
                column_key: "wt10.patient_id",
                op: "eq",
                value: "P-100",
              },
            ],
            time: null,
            grouping: null,
            debug: null,
          },
          sql_json: {
            version: 1,
            domainId: 1,
            columns: [
              {
                modelColumnId: 101,
                workspaceTableId: 10,
                columnName: "patient_id",
              },
            ],
            filters: null,
          },
          validation: {
            is_valid: true,
            errors: [],
            repairs_applied: [],
          },
          explanation: {
            summary: "Applied the requested patient filter.",
            summary_source: "llm",
            domain: {
              selected_domain_name: "Patient Domain",
              reason: "Contains patient identity attributes.",
            },
            dimensions: [],
            metrics: [],
            filters: [
              {
                label: "patient_id",
                op_label: "equals",
                value: "P-100",
                reason: "Matches requested patient id.",
                column_key: "wt10.patient_id",
              },
            ],
          },
          trace_id: "trace-filter-1",
          timings_ms: { total: 9 },
        });
      })
    );

    renderQueryForgePage();
    const user = userEvent.setup();

    await selectDomain(user);
    await openTool(user, "Filters");

    await user.click(screen.getByRole("button", { name: /ask queryforge ai/i }));
    await user.type(screen.getByLabelText(/^goal$/i), "Find patient P-100");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    await screen.findByRole("button", { name: /apply changes/i });
    await user.click(screen.getByRole("button", { name: /apply changes/i }));

    await openTool(user, "Filters");
    await waitFor(() => {
      expect(screen.getByText(/\(patient_id = "P-100"\)/)).toBeInTheDocument();
    });
  });

  it("hydrates Exclude Error Rows toggle OFF from sql_json.meta.apply_tdoe_severity_filter=false", async () => {
    server.use(
      http.post("*/api/v1/planner/plan_domain", async () =>
        HttpResponse.json({
          plan_json_v2: {
            schema_version: 2,
            trace_id: "trace-meta-apply-false",
            workspace_id: "ws-test",
            vertical_norm: "education",
            base_domain_id: 1,
            domain_name: "Patient Domain",
            intent: "list",
            selects: { dimensions: [], metrics: [] },
            filters: [],
            time: null,
            grouping: null,
            debug: null,
          },
          sql_json: {
            version: 1,
            domainId: 1,
            columns: [
              {
                modelColumnId: 101,
                workspaceTableId: 10,
                columnName: "patient_id",
              },
            ],
            meta: {
              apply_tdoe_severity_filter: false,
            },
          },
          validation: { is_valid: true, errors: [], repairs_applied: [] },
          explanation: {
            summary: "Applied TNDOE error-row filter preference.",
            summary_source: "deterministic",
            domain: {
              selected_domain_name: "Patient Domain",
              reason: "Contains requested attributes.",
            },
            dimensions: [],
            metrics: [],
            filters: [],
          },
          trace_id: "trace-meta-apply-false",
        })
      )
    );

    renderQueryForgePage();
    const user = userEvent.setup();

    await selectDomain(user);
    await openTool(user, "Columns");
    await user.click(screen.getByRole("button", { name: /ask queryforge ai/i }));
    await user.type(screen.getByLabelText(/^goal$/i), "Use planner response meta");
    await user.click(screen.getByRole("button", { name: /^send$/i }));
    await screen.findByRole("button", { name: /apply changes/i });
    await user.click(screen.getByRole("button", { name: /apply changes/i }));

    await openTool(user, "Domain");
    expect(screen.getByLabelText(/exclude error rows/i)).not.toBeChecked();
  });

  it("hydrates Exclude Error Rows toggle OFF from legacy sql_json.meta.include_error_rows=true", async () => {
    server.use(
      http.post("*/api/v1/planner/plan_domain", async () =>
        HttpResponse.json({
          plan_json_v2: {
            schema_version: 2,
            trace_id: "trace-meta-legacy",
            workspace_id: "ws-test",
            vertical_norm: "education",
            base_domain_id: 1,
            domain_name: "Patient Domain",
            intent: "list",
            selects: { dimensions: [], metrics: [] },
            filters: [],
            time: null,
            grouping: null,
            debug: null,
          },
          sql_json: {
            version: 1,
            domainId: 1,
            columns: [
              {
                modelColumnId: 101,
                workspaceTableId: 10,
                columnName: "patient_id",
              },
            ],
            meta: {
              include_error_rows: true,
            },
          },
          validation: { is_valid: true, errors: [], repairs_applied: [] },
          explanation: {
            summary: "Mapped legacy include_error_rows to TNDOE toggle.",
            summary_source: "deterministic",
            domain: {
              selected_domain_name: "Patient Domain",
              reason: "Contains requested attributes.",
            },
            dimensions: [],
            metrics: [],
            filters: [],
          },
          trace_id: "trace-meta-legacy",
        })
      )
    );

    renderQueryForgePage();
    const user = userEvent.setup();

    await selectDomain(user);
    await openTool(user, "Columns");
    await user.click(screen.getByRole("button", { name: /ask queryforge ai/i }));
    await user.type(screen.getByLabelText(/^goal$/i), "Use legacy planner response meta");
    await user.click(screen.getByRole("button", { name: /^send$/i }));
    await screen.findByRole("button", { name: /apply changes/i });
    await user.click(screen.getByRole("button", { name: /apply changes/i }));

    await openTool(user, "Domain");
    expect(screen.getByLabelText(/exclude error rows/i)).not.toBeChecked();
  });

  it("runs preview and renders result rows from mocked API", async () => {
    renderQueryForgePage();
    const user = userEvent.setup();

    await buildMinimalQuery(user);

    await user.click(screen.getByRole("button", { name: /run preview/i }));

    expect(await screen.findByText("P-100")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "patient_gender" })).toBeInTheDocument();

    const payload = getLastExecutionStartPayload();
    expect(payload?.kind).toBe("query_builder");
    expect(payload?.sqlJson?.domainId).toBe(1);
    expect(payload?.sqlJson?.columns?.some((c: { columnName: string }) => c.columnName === "patient_id")).toBe(true);
    expect(payload?.sql).toBeUndefined();
    expect(payload?.sqlRendered).toBeUndefined();
    expect(payload?.params).toBeUndefined();
    expect(payload?.countSql).toBeUndefined();
    expect(payload?.warehouse_id).toBeUndefined();
    expect(payload?.catalog).toBeUndefined();
    expect(payload?.schema).toBeUndefined();
    expect(payload?.mode).toBeUndefined();
    expect(Array.isArray(payload?.sqlJson?.value_overrideAttachments)).toBe(true);
    expect(payload?.sqlJson?.crosswalkAttachments).toBeUndefined();
  });

  it("uses latest builder sqlJson when running preview after adding another column", async () => {
    renderQueryForgePage();
    const user = userEvent.setup();

    await buildMinimalQuery(user);

    await user.click(screen.getByRole("button", { name: /run preview/i }));
    await screen.findByText("P-100");

    await selectColumn(user, "patient_gender");

    // Click preview immediately after changing builder state.
    await user.click(screen.getByRole("button", { name: /run preview/i }));

    await waitFor(() => {
      const payload = getLastExecutionStartPayload();
      expect(
        payload?.sqlJson?.columns?.some((c: { columnName: string }) => c.columnName === "patient_gender")
      ).toBe(true);
    });
  });

  it("shows refresh message when execution start request format is rejected", async () => {
    server.use(
      http.post(`${API_BASE}/executions/start`, () => {
        return HttpResponse.json(
          { error: "Raw SQL fields are not allowed in this endpoint: sql, params" },
          { status: 400 }
        );
      })
    );

    renderQueryForgePage();
    const user = userEvent.setup();

    await buildMinimalQuery(user);
    await user.click(screen.getByRole("button", { name: /run preview/i }));

    expect(await screen.findByText(/request format outdated, please refresh and try again\./i)).toBeInTheDocument();
  });

  it("renders empty state when preview returns no rows", async () => {
    server.use(
      http.get(`${API_BASE}/executions/:jobId/results`, () => {
        return HttpResponse.json(executionResultsEmptyFixture);
      })
    );

    renderQueryForgePage();
    const user = userEvent.setup();

    await buildMinimalQuery(user);
    await user.click(screen.getByRole("button", { name: /run preview/i }));

    expect(await screen.findByText("No rows returned.")).toBeInTheDocument();
  });

  it("renders preview error state when execution fails", async () => {
    server.use(
      http.get(`${API_BASE}/executions/:jobId/status`, () => {
        return HttpResponse.json({ jobId: "job-1", statementId: "stmt-1", status: "FAILED" });
      })
    );

    renderQueryForgePage();
    const user = userEvent.setup();

    await buildMinimalQuery(user);
    await user.click(screen.getByRole("button", { name: /run preview/i }));

    expect(await screen.findByText("Preview failed")).toBeInTheDocument();
  });

  it("clears selected columns and resets run eligibility", async () => {
    renderQueryForgePage();
    const user = userEvent.setup();

    await buildMinimalQuery(user);

    await user.click(await screen.findByRole("button", { name: /clear all/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /run preview/i })).toBeDisabled();
    });
  });

  it("supports keyboard activation for primary actions", async () => {
    renderQueryForgePage();
    const user = userEvent.setup();

    expect(screen.getByRole("button", { name: /save query/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^domain$/i })).toBeInTheDocument();

    await buildMinimalQuery(user);

    const runButton = screen.getByRole("button", { name: /run preview/i });
    runButton.focus();
    expect(runButton).toHaveFocus();

    await user.keyboard("{Enter}");

    expect(await screen.findByText("P-100")).toBeInTheDocument();
  });

  it.todo("adds a retry button to the domain initial-load error state");
  it.todo("covers saved-query save/create/update flows with optimistic UI assertions");
  it.todo("verifies preview result payloads are not persisted to localStorage");
});
