import React from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
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

const tablesPath = /\/dictionary\/tables/;
const columnsPath = /\/dictionary\/columns(?!\/search)/;

const TABLES = [
  { id: 1, table_name: "apple_table", full_name: "apple_table" },
  { id: 2, table_name: "zebra_table", full_name: "zebra_table" },
];

const COLUMNS = [
  {
    id: 10,
    workspace_table_id: 1,
    column_name: "col_a",
    data_type: "string",
    ordinal_position: 1,
    description: "Column A",
    is_active: true,
    semantic_type: null,
    semantic_entity: null,
    semantic_sub_type: null,
    semantic_confidence: null,
    sample_values_json: null,
    sample_stats_json: null,
    sample_ran_at: null,
    sample_error: null,
    table_name: "apple_table",
  },
];

describe("DictionaryTab — empty state", () => {
  it("shows 'Select a table' empty state when no table is selected", async () => {
    server.use(
      http.get(tablesPath, () => HttpResponse.json({ rows: TABLES, total: 2 })),
    );

    render(<DictionaryTab />, { wrapper });

    expect(
      await screen.findByText(/Click a table on the left to load/i),
    ).toBeInTheDocument();
  });
});

describe("DictionaryTab — table selection", () => {
  it("selecting a table renders the column grid", async () => {
    server.use(
      http.get(tablesPath, () => HttpResponse.json({ rows: TABLES, total: 2 })),
      http.get(columnsPath, () => HttpResponse.json({ rows: COLUMNS })),
    );

    render(<DictionaryTab />, { wrapper });

    const tableBtn = await screen.findByRole("button", {
      name: /apple_table/i,
    });
    await userEvent.click(tableBtn);

    await waitFor(() => {
      expect(screen.getByText("col_a")).toBeInTheDocument();
    });
  });
});

describe("DictionaryTab — upload modal", () => {
  it("upload modal opens and closes", async () => {
    server.use(
      http.get(tablesPath, () => HttpResponse.json({ rows: [], total: 0 })),
    );

    render(<DictionaryTab />, { wrapper });

    const uploadBtn = await screen.findByRole("button", { name: /^upload$/i });
    await userEvent.click(uploadBtn);

    expect(
      screen.getByRole("heading", { name: /upload data dictionary/i }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^close$/i }));

    expect(
      screen.queryByRole("heading", { name: /upload data dictionary/i }),
    ).not.toBeInTheDocument();
  });
});
