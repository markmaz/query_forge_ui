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
