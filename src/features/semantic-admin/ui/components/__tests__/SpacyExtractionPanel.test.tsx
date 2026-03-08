import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import SpacyExtractionPanel from "../SpacyExtractionPanel";

const sampleSpacy = {
  normalized_text: "find black kids in metro schools",
  ents: [
    { label: "RACE", text: "black", start: 5, end: 10 },
    { label: "ORG_SCHOOL", text: "metro schools", start: 19, end: 32 },
  ],
  by_label: {
    RACE: ["black"],
    ORG_SCHOOL: ["metro schools"],
  },
  slots: {
    metric: ["count"],
    dimensions: ["race"],
    subgroups: ["gender"],
    time_ranges: ["last year"],
    org_schools: ["metro schools"],
    org_districts: ["metro district"],
  },
  warnings: ["low_confidence_org"],
};

describe("SpacyExtractionPanel", () => {
  it("renders all sections when spacy exists", () => {
    render(<SpacyExtractionPanel spacy={sampleSpacy} />);

    expect(screen.getByText(/normalized text/i)).toBeInTheDocument();
    expect(screen.getByText(/find black kids in metro schools/i)).toBeInTheDocument();
    expect(screen.getByText(/slots/i)).toBeInTheDocument();
    expect(screen.getByText(/domain-model/i)).toBeInTheDocument();
    expect(screen.getByText(/by label/i)).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "RACE" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "black" })).toBeInTheDocument();
  });

  it("handles missing spacy payload", () => {
    render(<SpacyExtractionPanel spacy={null} />);
    expect(screen.getByText(/no spacy extraction data/i)).toBeInTheDocument();
  });

  it("renders warnings list", () => {
    render(<SpacyExtractionPanel spacy={sampleSpacy} />);
    expect(screen.getByText(/warnings/i)).toBeInTheDocument();
    expect(screen.getByText("low_confidence_org")).toBeInTheDocument();
  });
});
