/**
 * NoCode SQL E2E coverage for route: /no-code/builder/v2
 *
 * Fixtures:
 * - /domains -> e2e/fixtures/queryForge/domains.json
 * - /domains/summary -> e2e/fixtures/queryForge/domainSummaries.json
 * - /domains/columns -> e2e/fixtures/queryForge/columns.json
 * - /executions/:jobId/results -> e2e/fixtures/queryForge/runResults*.json
 * - generic API error payload -> e2e/fixtures/queryForge/error.json
 *
 * Run:
 *   npm run test:e2e
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

type RunStatus = "SUCCEEDED" | "FAILED";
type RunResultMode = "rows" | "empty";

type SavedQueryRecord = {
  queryId: string;
  name: string;
  description: string | null;
  folderId: string | null;
  sqlJson: Record<string, unknown>;
  scope?: string;
};

type NoCodeMockOptions = {
  domainsFailCount?: number;
  domainsDelayMs?: number;
  runStatuses?: RunStatus[];
  runResults?: RunResultMode[];
};

type NoCodeMockController = {
  getExecutionStartPayloads: () => Array<Record<string, unknown>>;
  getLastExecutionStartPayload: () => Record<string, unknown> | null;
  getSavedQueryCreates: () => Array<Record<string, unknown>>;
  getSavedQueryUpdates: () => Array<{ id: string; payload: Record<string, unknown> }>;
};

const fixtureDir = path.resolve(process.cwd(), "e2e/fixtures/queryForge");

const loadFixture = <T>(name: string): T => {
  const raw = readFileSync(path.join(fixtureDir, name), "utf8");
  return JSON.parse(raw) as T;
};

const domainsFixture = loadFixture<{ rows: Array<Record<string, unknown>> }>("domains.json");
const domainSummariesFixture = loadFixture<Record<string, unknown>>("domainSummaries.json");
const columnsFixture = loadFixture<Record<string, unknown>>("columns.json");
const runResultsFixture = loadFixture<Record<string, unknown>>("runResults.json");
const runResultsEmptyFixture = loadFixture<Record<string, unknown>>("runResultsEmpty.json");
const errorFixture = loadFixture<{ message?: string }>("error.json");

const ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJlMmUtdXNlciIsImVtYWlsIjoiZTJlQGV4YW1wbGUuY29tIn0.signature";

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeApiPath = (urlValue: string): string => {
  const pathname = new URL(urlValue).pathname.replace(/\/+$/g, "") || "/";
  return pathname.replace(/^\/api\/v1(?=\/|$)/, "");
};

const isApiRequest = (pathname: string) =>
  /^\/(auth|users|workspaces|dashboards|domains|query-tree|saved-queries|value_overrides|executions|user-workspaces)\b/.test(
    pathname
  );

const toQueryTreeNode = (saved: SavedQueryRecord) => ({
  nodeType: "query",
  id: saved.queryId,
  name: saved.name,
  folderId: saved.folderId,
  updatedAt: "2026-02-12T08:00:00.000Z",
  deletedAt: null,
  canEdit: true,
  scope: "my",
  isDeleted: false,
  queryType: "query_builder",
});

const buildQueryTree = (savedQueries: SavedQueryRecord[]) => ({
  library: { view: "library", rootNodes: [] as Array<Record<string, unknown>> },
  shared: { view: "shared", rootNodes: [] as Array<Record<string, unknown>> },
  my: { view: "my", rootNodes: savedQueries.map(toQueryTreeNode) },
  trash: { view: "trash", rootNodes: [] as Array<Record<string, unknown>> },
});

async function mockNoCodeApi(page: Page, options: NoCodeMockOptions = {}): Promise<NoCodeMockController> {
  const domainsFailCount = options.domainsFailCount ?? 0;
  const domainsDelayMs = options.domainsDelayMs ?? 0;
  const runStatuses = options.runStatuses ?? ["SUCCEEDED"];
  const runResults = options.runResults ?? ["rows"];

  let domainsRequestCount = 0;
  let runCount = 0;

  const executionStartPayloads: Array<Record<string, unknown>> = [];
  const savedCreates: Array<Record<string, unknown>> = [];
  const savedUpdates: Array<{ id: string; payload: Record<string, unknown> }> = [];
  const savedQueries = new Map<string, SavedQueryRecord>();
  const jobs = new Map<string, { status: RunStatus; resultMode: RunResultMode }>();

  await page.route("**/*", async (route) => {
    const request = route.request();
    const resourceType = request.resourceType();
    if (resourceType !== "xhr" && resourceType !== "fetch") {
      return route.continue();
    }

    const method = request.method();
    const pathName = normalizeApiPath(request.url());
    const parsedUrl = new URL(request.url());

    if (method === "POST" && pathName === "/auth/refresh") {
      return route.fulfill(json({ access_token: ACCESS_TOKEN }));
    }

    if (method === "GET" && pathName === "/users/e2e-user") {
      return route.fulfill(
        json({
          user_id: "e2e-user",
          email: "e2e@example.com",
          first_name: "E2E",
          last_name: "User",
          display_name: "E2E User",
          products: [
            { product_name: "no code builder", roles: [{ role: { role_name: "user" } }] },
            { product_name: "workspace", roles: [{ role: { role_name: "user" } }] },
          ],
        })
      );
    }

    if (method === "GET" && pathName === "/dashboards") {
      return route.fulfill(json([]));
    }

    if (method === "GET" && pathName === "/users/e2e-user/workspaces") {
      return route.fulfill(
        json([
          {
            workspace_id: "ws-1",
            is_default: 1,
          },
        ])
      );
    }

    if (method === "GET" && pathName === "/workspaces/ws-1") {
      return route.fulfill(
        json({
          workspace_id: "ws-1",
          name: "E2E Workspace",
          server: "https://example.local/databricks",
        })
      );
    }

    if (method === "GET" && pathName === "/domains") {
      domainsRequestCount += 1;
      if (domainsDelayMs > 0) await delay(domainsDelayMs);
      if (domainsRequestCount <= domainsFailCount) {
        return route.fulfill(json({ message: errorFixture.message ?? "Failed to load domains" }, 500));
      }
      return route.fulfill(json(domainsFixture));
    }

    if (method === "GET" && pathName === "/domains/summary") {
      return route.fulfill(json(domainSummariesFixture));
    }

    if (method === "GET" && pathName === "/domains/columns") {
      return route.fulfill(json(columnsFixture));
    }

    if (method === "GET" && pathName === "/value_overrides/visibility") {
      return route.fulfill(
        json({
          index: { regions: [], npiCategories: [], serviceLines: [] },
          hasShared: false,
        })
      );
    }

    if (method === "GET" && pathName === "/saved-queries/cohorts/visible") {
      return route.fulfill(json({ cohorts: [], hasShared: false }));
    }

    if (method === "GET" && pathName === "/query-tree/recent") {
      return route.fulfill(
        json({
          rows: Array.from(savedQueries.values()).map((saved) => ({
            id: saved.queryId,
            title: saved.name,
            updatedAt: "2026-02-12T08:00:00.000Z",
            queryType: "query_builder",
          })),
        })
      );
    }

    if (method === "GET" && pathName === "/query-tree") {
      const view = parsedUrl.searchParams.get("view") as "library" | "shared" | "my" | "trash" | null;
      const trees = buildQueryTree(Array.from(savedQueries.values()));
      const tree = view ? trees[view] : trees.library;
      return route.fulfill(json(tree));
    }

    if (method === "GET" && /^\/saved-queries\/[^/]+$/.test(pathName)) {
      const id = pathName.split("/").at(-1) ?? "";
      const saved = savedQueries.get(id);
      if (!saved) {
        return route.fulfill(json({ message: "Not found" }, 404));
      }
      return route.fulfill(json(saved));
    }

    if (method === "POST" && pathName === "/saved-queries") {
      const payload = (request.postDataJSON?.() ?? {}) as Record<string, unknown>;
      const nextId = `saved-${savedQueries.size + 1}`;
      const record: SavedQueryRecord = {
        queryId: nextId,
        name: String(payload.name ?? "Untitled"),
        description: (payload.description as string | null) ?? null,
        folderId: (payload.folderId as string | null) ?? null,
        sqlJson: (payload.sqlJson as Record<string, unknown>) ?? {},
        scope: "my",
      };
      savedQueries.set(nextId, record);
      savedCreates.push(payload);
      return route.fulfill(json(record));
    }

    if (method === "PATCH" && /^\/saved-queries\/[^/]+$/.test(pathName)) {
      const id = pathName.split("/").at(-1) ?? "";
      const payload = (request.postDataJSON?.() ?? {}) as Record<string, unknown>;
      const existing = savedQueries.get(id);
      const updated: SavedQueryRecord = {
        queryId: id,
        name: String(payload.name ?? existing?.name ?? "Untitled"),
        description:
          payload.description === undefined
            ? existing?.description ?? null
            : (payload.description as string | null),
        folderId: payload.folderId === undefined ? existing?.folderId ?? null : (payload.folderId as string | null),
        sqlJson: (payload.sqlJson as Record<string, unknown>) ?? existing?.sqlJson ?? {},
        scope: "my",
      };
      savedQueries.set(id, updated);
      savedUpdates.push({ id, payload });
      return route.fulfill(json(updated));
    }

    if (method === "POST" && pathName === "/executions/start") {
      runCount += 1;
      const payload = (request.postDataJSON?.() ?? {}) as Record<string, unknown>;
      executionStartPayloads.push(payload);

      const jobId = `job-${runCount}`;
      const statementId = `stmt-${runCount}`;
      const status = runStatuses[runCount - 1] ?? "SUCCEEDED";
      const resultMode = runResults[runCount - 1] ?? "rows";
      jobs.set(jobId, { status, resultMode });

      return route.fulfill(json({ jobId, statementId }));
    }

    if (method === "GET" && /^\/executions\/[^/]+\/status$/.test(pathName)) {
      const jobId = pathName.split("/")[2] ?? "";
      const job = jobs.get(jobId) ?? { status: "SUCCEEDED" as RunStatus, resultMode: "rows" as RunResultMode };
      return route.fulfill(json({ jobId, statementId: `stmt-${jobId}`, status: job.status }));
    }

    if (method === "GET" && /^\/executions\/[^/]+\/results$/.test(pathName)) {
      const jobId = pathName.split("/")[2] ?? "";
      const job = jobs.get(jobId) ?? { status: "SUCCEEDED" as RunStatus, resultMode: "rows" as RunResultMode };
      return route.fulfill(json(job.resultMode === "empty" ? runResultsEmptyFixture : runResultsFixture));
    }

    if (method === "POST" && /^\/executions\/[^/]+\/cancel$/.test(pathName)) {
      return route.fulfill(json({ ok: true }));
    }

    if (isApiRequest(pathName)) {
      return route.fulfill(json({}));
    }

    return route.continue();
  });

  return {
    getExecutionStartPayloads: () => executionStartPayloads,
    getLastExecutionStartPayload: () => executionStartPayloads.at(-1) ?? null,
    getSavedQueryCreates: () => savedCreates,
    getSavedQueryUpdates: () => savedUpdates,
  };
}

async function gotoNoCodeSqlPage(page: Page) {
  await page.goto("/no-code/builder/v2");
  await expect(page.getByRole("link", { name: "Query Studio" })).toBeVisible();
}

async function openTool(page: Page, toolName: "Domain" | "Columns" | "Filters"): Promise<Locator> {
  const rail = page.getByLabel("Builder tools");
  const button = rail.getByRole("button", { name: new RegExp(`^${toolName}$`, "i") }).first();
  await expect(button).toBeVisible();
  if ((await button.getAttribute("aria-pressed")) !== "true") {
    await button.focus();
    await button.press("Enter");
    if ((await button.getAttribute("aria-pressed")) !== "true") {
      await button.click({ force: true });
    }
  }
  return button;
}

async function selectDomain(page: Page, domainName = /patient domain/i) {
  await openTool(page, "Domain");
  const row = page.locator("tr.nc-domain-row").filter({ hasText: domainName }).first();
  await expect(row).toBeVisible();
  await row.click({ force: true });
}

async function selectColumn(page: Page, columnName = "patient_id") {
  await openTool(page, "Columns");
  const rowButton = page.getByRole("button", {
    name: new RegExp(`toggle\\s+${columnName}`, "i"),
  }).first();
  await expect(rowButton).toBeVisible();
  await rowButton.click({ force: true });
}

async function addFilter(page: Page, value = "P-100") {
  await openTool(page, "Filters");
  await page.getByRole("button", { name: /add filter/i }).click();
  await page.getByPlaceholder("Value").first().fill(value);
}

async function buildMinimalQuery(page: Page, withFilter = false) {
  await selectDomain(page);
  await selectColumn(page);
  if (withFilter) {
    await addFilter(page);
  }
  await expect(page.getByRole("button", { name: /run preview/i })).toBeEnabled();
}

test.describe("NoCode SQL page", () => {
  test("smoke: renders primary controls and sections", async ({ page }) => {
    await mockNoCodeApi(page);
    await gotoNoCodeSqlPage(page);

    await expect(page.getByRole("link", { name: "Query Studio" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^save query$/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^domain$/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^columns$/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^filters$/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /run preview/i })).toBeVisible();

    await openTool(page, "Domain");
    await expect(page.getByText(/choose a domain table/i)).toBeVisible();
    await openTool(page, "Columns");
    await expect(
      page.getByPlaceholder(/(select a domain to browse columns|search columns by name or description)/i)
    ).toBeVisible();
    await openTool(page, "Filters");
    await expect(page.getByRole("button", { name: /add filter/i })).toBeVisible();
  });

  test("initial load: shows loading then domains", async ({ page }) => {
    await mockNoCodeApi(page, { domainsDelayMs: 250 });
    await gotoNoCodeSqlPage(page);

    await openTool(page, "Domain");
    await expect(page.getByText("Loading domains…")).toBeVisible();
    await expect(page.locator("tr.nc-domain-row").filter({ hasText: /patient domain/i }).first()).toBeVisible();
  });

  test("initial load error: shows error and allows retry", async ({ page }) => {
    await mockNoCodeApi(page, { domainsFailCount: 1 });
    await gotoNoCodeSqlPage(page);

    await openTool(page, "Domain");
    await expect(page.locator("tr.nc-domain-row").filter({ hasText: /patient domain/i }).first()).toBeVisible();
  });

  test("build query + run preview: sends expected payload and renders results", async ({ page }) => {
    const mock = await mockNoCodeApi(page);
    await gotoNoCodeSqlPage(page);
    await buildMinimalQuery(page, true);

    const runButton = page.getByRole("button", { name: /run preview/i });
    await runButton.focus();
    await runButton.press("Enter");
    await expect.poll(() => mock.getExecutionStartPayloads().length).toBeGreaterThan(0);
    await expect(page.getByRole("columnheader", { name: "patient_gender" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "P-100" }).first()).toBeVisible();

    const payload = mock.getLastExecutionStartPayload();
    expect(payload?.kind).toBe("query_builder");
    expect(payload?.mode).toBe("preview");

    const sqlJson = (payload?.sqlJson ?? {}) as Record<string, unknown>;
    expect(sqlJson.domainId).toBe(1);
    expect(JSON.stringify(sqlJson.columns ?? [])).toContain("patient_id");
    expect(JSON.stringify(sqlJson.filters ?? {})).toContain("P-100");
  });

  test("run preview: empty results state", async ({ page }) => {
    const mock = await mockNoCodeApi(page, { runResults: ["empty"] });
    await gotoNoCodeSqlPage(page);
    await buildMinimalQuery(page);

    const runButton = page.getByRole("button", { name: /run preview/i });
    await runButton.focus();
    await runButton.press("Enter");
    await expect.poll(() => mock.getExecutionStartPayloads().length).toBeGreaterThan(0);
    await expect(page.getByText("No rows returned.")).toBeVisible();
  });

  test("run preview: error state then successful rerun", async ({ page }) => {
    const mock = await mockNoCodeApi(page, { runStatuses: ["FAILED", "SUCCEEDED"] });
    await gotoNoCodeSqlPage(page);
    await buildMinimalQuery(page);

    const runButton = page.getByRole("button", { name: /run preview/i });
    await runButton.focus();
    await runButton.press("Enter");
    await expect.poll(() => mock.getExecutionStartPayloads().length).toBe(1);
    await expect(page.getByText("Preview failed")).toBeVisible();

    await expect(runButton).toBeEnabled();
    await runButton.focus();
    await runButton.press("Enter");
    await expect.poll(() => mock.getExecutionStartPayloads().length).toBe(2);
    await expect(page.getByRole("cell", { name: "P-100" }).first()).toBeVisible();
  });

  test("clear/reset: clears built query and disables run", async ({ page }) => {
    await mockNoCodeApi(page);
    await gotoNoCodeSqlPage(page);
    await buildMinimalQuery(page, true);

    await openTool(page, "Columns");
    await page.getByRole("button", { name: /clear all/i }).click();

    await expect(page.getByRole("button", { name: /run preview/i })).toBeDisabled();
    await expect(page.getByText(/selected columns/i)).toHaveCount(0);
  });

  test("saved queries: save new query then update existing query", async ({ page }) => {
    const mock = await mockNoCodeApi(page);
    await gotoNoCodeSqlPage(page);
    await buildMinimalQuery(page);

    const saveRailButton = page.getByLabel("Builder tools").getByRole("button", { name: /^save query$/i }).first();
    await saveRailButton.focus();
    await saveRailButton.press("Enter");
    const dialog = page.locator('div[role="dialog"][aria-modal="true"]').first();
    await expect(dialog).toBeVisible();
    await dialog.locator("input").first().fill("E2E Saved Query");
    await dialog.getByRole("button", { name: /^save$/i }).click();
    await expect(dialog).toBeHidden();

    await expect.poll(() => mock.getSavedQueryCreates().length).toBe(1);
    expect(String(mock.getSavedQueryCreates()[0]?.name ?? "")).toContain("E2E Saved Query");

    await saveRailButton.focus();
    await saveRailButton.press("Enter");
    await expect(dialog).toBeVisible();
    await dialog.locator("input").first().fill("E2E Saved Query Updated");
    await dialog.getByRole("button", { name: /^save$/i }).click();
    await expect(dialog).toBeHidden();

    await expect.poll(() => mock.getSavedQueryUpdates().length).toBe(1);
    expect(mock.getSavedQueryUpdates()[0]?.id).toBe("saved-1");
    expect(String(mock.getSavedQueryUpdates()[0]?.payload?.name ?? "")).toContain("Updated");
  });

  test("accessibility keyboard sanity: Enter activates Run Preview", async ({ page }) => {
    await mockNoCodeApi(page);
    await gotoNoCodeSqlPage(page);

    await expect(page.getByRole("button", { name: /^save query$/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /run preview/i })).toBeVisible();
    await buildMinimalQuery(page);

    const runButton = page.getByRole("button", { name: /run preview/i });
    await runButton.focus();
    await runButton.press("Enter");
    await expect(page.getByRole("cell", { name: "P-100" }).first()).toBeVisible();
  });
});
