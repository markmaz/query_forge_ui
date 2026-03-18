import React from "react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../../../../qa/msw/server";
import { DictionaryTab } from "../DictionaryTab";

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Minimal wrappers
function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("DictionaryTab — unmatched import banner", () => {
  it("shows warning banner when import returns unmatched columns", async () => {
    // Override import handler to return unmatched
    server.use(
      http.post("*/dictionary/columns/import", () =>
        HttpResponse.json({
          updated: 2,
          unmatched: [{ table_name: "dim_foo", column_name: "bar" }],
        }),
      ),
    );

    render(<DictionaryTab />, { wrapper });

    // Open upload modal
    const uploadBtn = await screen.findByRole("button", { name: /upload/i });
    await userEvent.click(uploadBtn);

    // Attach a file
    const fileInput = screen.getByLabelText(/file/i);
    const file = new File(["table_name,column_name\ndim_foo,bar"], "test.csv", {
      type: "text/csv",
    });
    await userEvent.upload(fileInput, file);

    // Submit
    const submitBtn = screen.getByRole("button", {
      name: /upload/i,
      hidden: false,
    });
    await userEvent.click(submitBtn);

    // Banner should appear
    await waitFor(() => {
      expect(
        screen.getByText(/1 column\(s\) in your file weren't found/i),
      ).toBeInTheDocument();
    });
  });
});
