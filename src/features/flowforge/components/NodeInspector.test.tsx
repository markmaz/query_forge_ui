import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { FlowForgeNode } from "../model/types";
import NodeInspector from "./NodeInspector";

describe("NodeInspector", () => {
  it("does not expose Map / Transform internal validation objects as detail inputs", () => {
    const node: FlowForgeNode = {
      id: "map-1",
      type: "map_transform",
      label: "Map intake values",
      position: { x: 0, y: 0 },
      data: {
        mode: "run_context",
        field_mapping: [],
        template_fields: [],
        validations: [{ field: "values.patient.email", rule: "required" }],
      },
    };

    render(<NodeInspector node={node} editable />);

    expect(screen.getByText("Workflow Value Mapper")).toBeInTheDocument();
    expect(screen.queryByLabelText(/validations/i)).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("[object Object]")).not.toBeInTheDocument();
  });
});
