/**
 * Auth E2E coverage for route: /auth
 *
 * Fixtures:
 * - Uses inlined fixture objects matching the files under e2e/fixtures/auth/
 *
 * Run:
 *   npm run test:e2e -- e2e/auth.spec.ts
 */
import { expect, test, type Page } from "@playwright/test";

type AuthMockOptions = {
  refreshStatus?: number;
  loginStatus?: number;
  otpStatus?: number;
  resetRequestStatus?: number;
  resetValidateStatus?: number;
  resetPasswordStatus?: number;
  inviteValidateStatus?: number;
  registerStatus?: number;
};

type JsonRecord = Record<string, unknown>;

type AuthMockController = {
  getLastLoginPayload: () => JsonRecord | null;
  getLastOtpPayload: () => JsonRecord | null;
  getLastResetRequestPayload: () => JsonRecord | null;
  getLastResetPasswordPayload: () => JsonRecord | null;
  getLastRegistrationPayload: () => JsonRecord | null;
};

const loginChallengeFixture: JsonRecord = {
  requires_otp: true,
  challenge_id: "challenge-e2e-1",
  challenge_expires_in: 300,
};

const otpVerifySuccessFixture: JsonRecord = {
  access_token: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJlMmUtdXNlciIsImVtYWlsIjoiZTJlQGV4YW1wbGUuY29tIn0.signature",
  token_type: "Bearer",
  expires_in: 900,
};

const inviteValidateFixture: JsonRecord = {
  user_id: "user-1",
  email: "invitee@example.com",
};

const userProfileFixture: JsonRecord = {
  user_id: "e2e-user",
  email: "e2e@example.com",
  first_name: "E2E",
  last_name: "User",
  display_name: "E2E User",
  products: [
    {
      product_name: "workspace",
      roles: [{ role: { role_name: "user" } }],
    },
  ],
};

const userWorkspacesFixture: Array<JsonRecord> = [
  {
    workspace_id: "ws-1",
    is_default: 1,
  },
];

const workspaceDetailFixture: JsonRecord = {
  workspace_id: "ws-1",
  name: "E2E Workspace",
  server: "https://example.local/databricks",
};

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
  /^\/(auth|users|workspaces|user-workspaces|query-tree|dashboards)\b/.test(pathname);

async function mockAuthApi(page: Page, options: AuthMockOptions = {}) {
  const {
    refreshStatus = 401,
    loginStatus = 200,
    otpStatus = 200,
    resetRequestStatus = 200,
    resetValidateStatus = 200,
    resetPasswordStatus = 204,
    inviteValidateStatus = 200,
    registerStatus = 200,
  } = options;

  let lastLoginPayload: JsonRecord | null = null;
  let lastOtpPayload: JsonRecord | null = null;
  let lastResetRequestPayload: JsonRecord | null = null;
  let lastResetPasswordPayload: JsonRecord | null = null;
  let lastRegistrationPayload: JsonRecord | null = null;

  await page.route("**/*", async (route) => {
    const request = route.request();
    const resourceType = request.resourceType();
    if (resourceType !== "xhr" && resourceType !== "fetch") {
      return route.continue();
    }

    const method = request.method();
    const pathName = normalizeApiPath(request.url());

    if (method === "POST" && pathName === "/auth/refresh") {
      if (refreshStatus === 200) {
        return route.fulfill(json(otpVerifySuccessFixture, 200));
      }
      return route.fulfill(json({ message: "Unauthorized" }, refreshStatus));
    }

    if (method === "POST" && pathName === "/auth/login") {
      lastLoginPayload = (request.postDataJSON?.() ?? {}) as JsonRecord;
      if (loginStatus === 200) {
        return route.fulfill(json(loginChallengeFixture, 200));
      }
      const message = loginStatus === 429 ? "Too many OTP requests" : "Invalid username or password";
      return route.fulfill(json({ message }, loginStatus));
    }

    if (method === "POST" && pathName === "/otp/verify") {
      lastOtpPayload = (request.postDataJSON?.() ?? {}) as JsonRecord;
      if (otpStatus === 200) {
        return route.fulfill(json(otpVerifySuccessFixture, 200));
      }
      const message = otpStatus === 400 ? "challenge_id and otp are required" : "Invalid code or expired challenge";
      return route.fulfill(json({ error: message }, otpStatus));
    }

    if (method === "POST" && pathName === "/auth/reset/request") {
      lastResetRequestPayload = (request.postDataJSON?.() ?? {}) as JsonRecord;
      if (resetRequestStatus >= 200 && resetRequestStatus < 300) {
        return route.fulfill(json({ ok: true }, 200));
      }
      return route.fulfill(json({ message: "Account not found" }, resetRequestStatus));
    }

    if (method === "POST" && pathName === "/auth/reset/validate") {
      if (resetValidateStatus === 200) {
        return route.fulfill(json({ valid: true }, 200));
      }
      return route.fulfill(json({ message: "Invalid reset token" }, resetValidateStatus));
    }

    if (method === "POST" && pathName === "/auth/reset/password") {
      lastResetPasswordPayload = (request.postDataJSON?.() ?? {}) as JsonRecord;
      if (resetPasswordStatus === 204) {
        return route.fulfill({ status: 204, body: "" });
      }
      return route.fulfill(json({ message: "Password was not reset" }, resetPasswordStatus));
    }

    if (method === "GET" && /^\/auth\/invite\/validate\/[^/]+$/.test(pathName)) {
      if (inviteValidateStatus === 200) {
        return route.fulfill(json(inviteValidateFixture, 200));
      }
      return route.fulfill(json({ message: "Invite token invalid" }, inviteValidateStatus));
    }

    if (method === "PUT" && /^\/users\/[^/]+$/.test(pathName)) {
      lastRegistrationPayload = (request.postDataJSON?.() ?? {}) as JsonRecord;
      if (registerStatus === 200) {
        return route.fulfill(json({ ...inviteValidateFixture, status: "Active" }, 200));
      }
      return route.fulfill(json({ message: "Registration failed" }, registerStatus));
    }

    if (method === "GET" && pathName === "/users/e2e-user") {
      return route.fulfill(json(userProfileFixture, 200));
    }

    if (method === "GET" && pathName === "/users/e2e-user/workspaces") {
      return route.fulfill(json(userWorkspacesFixture, 200));
    }

    if (method === "GET" && pathName === "/workspaces/ws-1") {
      return route.fulfill(json(workspaceDetailFixture, 200));
    }

    if (method === "GET" && pathName === "/query-tree") {
      return route.fulfill(
        json({
          library: { view: "library", rootNodes: [] },
          shared: { view: "shared", rootNodes: [] },
          my: { view: "my", rootNodes: [] },
          trash: { view: "trash", rootNodes: [] },
        })
      );
    }

    if (method === "GET" && pathName === "/dashboards") {
      return route.fulfill(json([], 200));
    }

    if (isApiRequest(pathName)) {
      return route.fulfill(json({}, 200));
    }

    return route.continue();
  });

  return {
    getLastLoginPayload: () => lastLoginPayload,
    getLastOtpPayload: () => lastOtpPayload,
    getLastResetRequestPayload: () => lastResetRequestPayload,
    getLastResetPasswordPayload: () => lastResetPasswordPayload,
    getLastRegistrationPayload: () => lastRegistrationPayload,
  } satisfies AuthMockController;
}

test.describe("Auth flows", () => {
  test("login + otp: submits expected auth payloads", async ({ page }) => {
    const mock = await mockAuthApi(page, { refreshStatus: 401 });
    await page.goto("/auth");

    const credentials = page.getByRole("textbox");
    await credentials.nth(0).fill("user@example.com");
    await credentials.nth(1).fill("Password123!");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/auth\/otp$/);
    for (let i = 1; i <= 6; i += 1) {
      await page.getByLabel(`Digit ${i}`).fill(String(i));
    }
    await page.locator("form.theme-form").dispatchEvent("submit");

    await expect.poll(() => mock.getLastOtpPayload()).toEqual({
      challenge_id: "challenge-e2e-1",
      otp: "123456",
    });
    expect(mock.getLastLoginPayload()).toEqual({
      username: "user@example.com",
      password: "Password123!",
    });
  });

  test("login: shows generic message for invalid credentials", async ({ page }) => {
    await mockAuthApi(page, { refreshStatus: 401, loginStatus: 401 });
    await page.goto("/auth");

    const credentials = page.getByRole("textbox");
    await credentials.nth(0).fill("wrong@example.com");
    await credentials.nth(1).fill("bad-password");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/auth$/);
    await expect(page).not.toHaveURL(/\/auth\/otp$/);
  });

  test("forgot password: submits email and lands on success screen", async ({ page }) => {
    const mock = await mockAuthApi(page, { refreshStatus: 401 });
    await page.goto("/auth");

    await page.getByRole("link", { name: /forgot password\?/i }).click();
    await expect(page).toHaveURL(/\/auth\/forgot$/);

    await page.locator('input[type="text"]').first().fill("user@example.com");
    await page.getByRole("button", { name: /reset password/i }).click();

    await expect(page).toHaveURL(/\/auth\/forgot_success$/);
    await expect(page.getByRole("heading", { name: /check your email/i })).toBeVisible();
    expect(mock.getLastResetRequestPayload()).toEqual({ email: "user@example.com" });
  });

  test("forgot password: keeps generic success screen even when backend request fails", async ({ page }) => {
    const mock = await mockAuthApi(page, { refreshStatus: 401, resetRequestStatus: 404 });
    await page.goto("/auth/forgot");

    await page.locator('input[type="text"]').first().fill("unknown@example.com");
    await page.getByRole("button", { name: /reset password/i }).click();

    await expect(page).toHaveURL(/\/auth\/forgot_success$/);
    await expect(page.getByText(/if an account exists for that email, a reset link has been sent\./i)).toBeVisible();
    expect(mock.getLastResetRequestPayload()).toEqual({ email: "unknown@example.com" });
  });

  test("reset password: validates token and returns to login", async ({ page }) => {
    const mock = await mockAuthApi(page, { refreshStatus: 401 });
    await page.goto("/auth/reset?token=reset-token-1");

    await expect(page.getByRole("heading", { name: /password reset/i })).toBeVisible();
    const nextPassword = "StrongPassword123!";
    await page.locator('input[type="password"]').nth(0).fill(nextPassword);
    await page.locator('input[type="password"]').nth(1).fill(nextPassword);
    await page.getByRole("button", { name: /register/i }).click();

    await expect(page).toHaveURL(/\/auth$/);
    expect(mock.getLastResetPasswordPayload()).toEqual({ password: nextPassword });
  });

  test("registration: submits invite-based registration payload", async ({ page }) => {
    const mock = await mockAuthApi(page, { refreshStatus: 401 });
    await page.goto("/auth/register?token=invite-token-1");

    await expect(page.getByText(/invited as invitee@example\.com/i)).toBeVisible();
    await page.locator('input[type="text"]').nth(0).fill("Jane");
    await page.locator('input[type="text"]').nth(1).fill("Doe");
    await page.locator('input[type="password"]').nth(0).fill("StrongPassword123!");
    await page.locator('input[type="password"]').nth(1).fill("StrongPassword123!");
    await page.getByRole("button", { name: /register/i }).click();

    await expect(page).toHaveURL(/\/auth\/success$/);
    await expect(page.getByRole("heading", { name: /registration successful/i })).toBeVisible();
    expect(mock.getLastRegistrationPayload()).toEqual({
      first_name: "Jane",
      last_name: "Doe",
      password: "StrongPassword123!",
      user_id: "user-1",
      email: "invitee@example.com",
      status: "Active",
    });
  });

  test("registration: shows generic message for invalid or expired invite token", async ({ page }) => {
    await mockAuthApi(page, { refreshStatus: 401, inviteValidateStatus: 404 });
    await page.goto("/auth/register?token=expired-token");

    await expect(page.getByRole("alert")).toHaveText(/invalid or expired invitation link\./i);
    await expect(page.getByText(/invite token invalid/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /register/i })).toBeDisabled();
  });
});
