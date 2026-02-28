/**
 * QueryForge AI Copilot e2e coverage for route: /no-code/builder/v2
 *
 * Run:
 *   npm run test:e2e -- e2e/query-forge-ai-copilot.spec.ts
 */
import { expect, test, type Page } from "@playwright/test";

const ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJlMmUtdXNlciIsImVtYWlsIjoiZTJlQGV4YW1wbGUuY29tIn0.signature";

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

const normalizeApiPath = (urlValue: string): string => {
  const pathname = new URL(urlValue).pathname.replace(/\/+$/g, "") || "/";
  return pathname.replace(/^\/api\/v1(?=\/|$)/, "");
};

const isApiRequest = (pathname: string) =>
  /^\/(auth|users|workspaces|dashboards|domains|query-tree|saved-queries|value_overrides|executions|user-workspaces)\b/.test(
    pathname
  );

async function mockQueryForgeApi(page: Page) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const resourceType = request.resourceType();
    if (resourceType !== "xhr" && resourceType !== "fetch") {
      return route.continue();
    }

    const method = request.method();
    const pathName = normalizeApiPath(request.url());

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
      return route.fulfill(json([{ workspace_id: "ws-1", is_default: 1 }]));
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
      return route.fulfill(
        json({
          rows: [
            {
              id: 1,
              name: "Patient Domain",
              description: "Patient-centric domain",
              kind: "domain",
              model_table_id: null,
            },
          ],
        })
      );
    }

    if (method === "GET" && pathName === "/domains/summary") {
      return route.fulfill(
        json({
          rows: [
            {
              id: 1,
              table_count: 3,
              table_sample: ["patients", "encounters", "claims"],
            },
          ],
        })
      );
    }

    if (method === "GET" && pathName === "/domains/columns") {
      return route.fulfill(
        json({
          rows: [
            {
              model_column_id: 101,
              workspace_table_id: 201,
              column_name: "patient_id",
              column_label: "patient_id",
              table_name: "patients",
              data_type: "string",
              nullable: false,
            },
            {
              model_column_id: 102,
              workspace_table_id: 201,
              column_name: "patient_gender",
              column_label: "patient_gender",
              table_name: "patients",
              data_type: "string",
              nullable: true,
            },
          ],
          total: 2,
          limit: 15,
          offset: 0,
        })
      );
    }

    if (method === "POST" && pathName === "/ai/suggest") {
      const body = request.postDataJSON() as {
        prompt?: string;
        currentSqlJson?: Record<string, unknown>;
      };
      const currentSqlJson = (body?.currentSqlJson ?? {}) as Record<string, unknown>;
      const existingColumns = Array.isArray(currentSqlJson.columns) ? currentSqlJson.columns : [];
      const sqlJson = {
        ...currentSqlJson,
        columns: [
          ...existingColumns,
          { modelColumnId: null, columnName: "patient_id", workspaceTableId: 201, exprId: null },
          { modelColumnId: null, columnName: "patient_gender", workspaceTableId: 201, exprId: null },
        ],
      };

      return route.fulfill(
        json({
          edits: [
            {
              op: "addSelect",
              col: { modelColumnId: null, columnName: "patient_id", workspaceTableId: 201, exprId: null },
            },
            {
              op: "addSelect",
              col: { modelColumnId: null, columnName: "patient_gender", workspaceTableId: 201, exprId: null },
            },
          ],
          explanation: body?.prompt ?? "AI suggestions ready",
          confidence: 0.91,
          sqlJson,
          debug: { model: "e2e-mock", attempts: 1 },
        })
      );
    }

    if (method === "GET" && pathName === "/value_overrides/visibility") {
      return route.fulfill(json({ index: { regions: [], npiCategories: [], serviceLines: [] }, hasShared: false }));
    }

    if (method === "GET" && pathName === "/saved-queries/cohorts/visible") {
      return route.fulfill(json({ cohorts: [], hasShared: false }));
    }

    if (method === "GET" && pathName === "/query-tree/recent") {
      return route.fulfill(json({ rows: [] }));
    }

    if (method === "GET" && pathName === "/query-tree") {
      return route.fulfill(json({ view: "my", rootNodes: [] }));
    }

    if (isApiRequest(pathName)) {
      return route.fulfill(json({}));
    }

    return route.continue();
  });
}

async function gotoQueryStudio(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
  await page.goto("/no-code/builder/v2");
  await expect(page.getByRole("link", { name: "Query Studio" })).toBeVisible();
}

async function openTool(page: Page, toolName: "Domain" | "Columns" | "Data Prep") {
  const button = page.getByRole("button", { name: new RegExp(`^${toolName}$`, "i") }).first();
  await expect(button).toBeVisible();
  if ((await button.getAttribute("aria-pressed")) !== "true") {
    await button.click({ force: true });
  }
}

async function selectDomain(page: Page) {
  await openTool(page, "Domain");
  await page.getByRole("button", { name: /patient domain/i }).click();
}

test.describe("QueryForge AI Copilot", () => {
  test("floating Ask AI button renders", async ({ page }) => {
    await mockQueryForgeApi(page);
    await gotoQueryStudio(page);

    await expect(page.getByRole("button", { name: /ask queryforge ai/i })).toBeVisible();
  });

  test("click opens AI drawer and Escape closes", async ({ page }) => {
    await mockQueryForgeApi(page);
    await gotoQueryStudio(page);
    const aiPanel = page.getByRole("region", { name: "QueryForge AI" });

    await page.getByRole("button", { name: /ask queryforge ai/i }).dispatchEvent("click");
    await expect(aiPanel).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(aiPanel).not.toBeVisible();
  });

  test("Ctrl+K toggles AI drawer", async ({ page }) => {
    await mockQueryForgeApi(page);
    await gotoQueryStudio(page);
    const aiPanel = page.getByRole("region", { name: "QueryForge AI" });

    await page.locator("body").click({ position: { x: 20, y: 20 } });
    await page.keyboard.press("Control+/");
    await expect(aiPanel).toBeVisible();

    await page.keyboard.press("Control+/");
    await expect(aiPanel).not.toBeVisible();
  });

  test("summary Domain edit updates AI active section", async ({ page }) => {
    await mockQueryForgeApi(page);
    await gotoQueryStudio(page);

    await page.getByRole("button", { name: "Domain edit", exact: true }).click({ force: true });
    await page.keyboard.press("Control+/");

    await expect(page.getByText(/helping with:\s*domain/i)).toBeVisible();
  });

  test("section Need Help link opens AI with section context", async ({ page }) => {
    await mockQueryForgeApi(page);
    await gotoQueryStudio(page);
    const aiPanel = page.getByRole("region", { name: "QueryForge AI" });

    await openTool(page, "Domain");
    await page.getByRole("button", { name: /need help with domain/i }).click({ force: true });

    await expect(aiPanel).toBeVisible();
    await expect(page.getByText(/helping with:\s*domain/i)).toBeVisible();
  });

  test("Data Prep tool updates AI context", async ({ page }) => {
    await mockQueryForgeApi(page);
    await gotoQueryStudio(page);

    await page.keyboard.press("Control+/");
    await openTool(page, "Data Prep");

    await expect(page.getByText(/helping with:\s*data prep/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /suggest data cleanup rules/i })).toBeVisible();
  });

  test("AI pane remains open when opening query tool drawers", async ({ page }) => {
    await mockQueryForgeApi(page);
    await gotoQueryStudio(page);
    const aiPanel = page.getByRole("region", { name: "QueryForge AI" });

    await page.keyboard.press("Control+/");
    await expect(aiPanel).toBeVisible();

    await openTool(page, "Domain");
    await expect(aiPanel).toBeVisible();
    await expect(page.getByText(/choose a domain table/i)).toBeVisible();
  });

  test("sending prompt shows suggestions and apply updates builder state", async ({ page }) => {
    await mockQueryForgeApi(page);
    await gotoQueryStudio(page);
    const aiPanel = page.getByRole("region", { name: "QueryForge AI" });

    await selectDomain(page);
    await expect(page.getByRole("button", { name: /run preview/i })).toBeDisabled();

    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toMatch(/clear your current query and start something new/i);
      await dialog.accept();
    });
    await page.keyboard.press("Control+/");

    await expect(aiPanel).toBeVisible();

    await page.getByLabel("Goal").fill("Suggest columns for a starter query");
    await page.getByRole("button", { name: /^send$/i }).click();
    const card = page.locator(".ncqv2-ai-card").filter({ hasText: /apply ai query plan/i }).first();
    await expect(card).toBeVisible();

    await card.getByRole("button", { name: /review changes/i }).click();
    await card.getByRole("button", { name: /apply changes/i }).click();

    await expect(page.getByRole("button", { name: /run preview/i })).toBeEnabled();
  });
});
