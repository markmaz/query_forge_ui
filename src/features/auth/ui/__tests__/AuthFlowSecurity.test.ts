import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("auth flow security guards", () => {
  it("does not reference the removed otp/generate endpoint in auth path files", () => {
    const root = process.cwd();
    const files = [
      "src/features/auth/ui/SignInForm.tsx",
      "src/features/auth/ui/OtpForm.tsx",
      "src/features/auth/model/authSlice.ts",
      "src/shared/services/auth.ts",
    ];

    files.forEach((file) => {
      const content = readFileSync(path.join(root, file), "utf8");
      expect(content).not.toContain("/otp/generate");
      expect(content).not.toContain("generateOTP(");
    });
  });
});
