import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import IndexCard from "./IndexCard";

describe("IndexCard", () => {
  it("renders nested object and array result fields as readable metrics", () => {
    render(
      <IndexCard
        title="Domain Vectors"
        description="Domain profiles for planner routing"
        status="completed"
        result={{
          total: 0,
          upserted: 0,
          skipped: 0,
          errors: [],
          timings_ms: { total: 67 },
          collection: {
            collection: "domain_catalog_v1",
            vector_size: 384,
            distance: "cosine",
            payload_indexes: ["is_active", "domain_version", "workspace_id"],
          },
        }}
        onRebuild={() => {}}
        disabled={false}
      />,
    );

    expect(screen.getByRole("heading", { name: /domain vectors/i })).toBeInTheDocument();
    expect(screen.getByText("timings ms total")).toBeInTheDocument();
    expect(screen.getByText("67")).toBeInTheDocument();
    expect(screen.getByText("collection name")).toBeInTheDocument();
    expect(screen.getByText("domain_catalog_v1")).toBeInTheDocument();
    expect(screen.getByText("collection payload indexes")).toBeInTheDocument();
    expect(screen.getByText("is_active, domain_version, workspace_id")).toBeInTheDocument();
    expect(screen.getByText("errors")).toBeInTheDocument();
    expect(screen.getByText("none")).toBeInTheDocument();
  });
});
