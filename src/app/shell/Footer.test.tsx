import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Footer from "./Footer";
import { APP_VERSION } from "../../shared/meta/appVersion";

vi.mock("../../shared/react-hooks/useAppVersion", () => ({
  useAppVersion: () => ({
    versionText: "9.9.9",
    raw: { version: "9.9.9", build: "build-9" },
    isLoading: false,
    isError: false,
  }),
}));

describe("Footer", () => {
  it("renders frontend and backend version text", () => {
    render(<Footer />);

    expect(screen.getByText(`Version: Front End ${APP_VERSION}, API 9.9.9`)).toBeInTheDocument();
  });
});
