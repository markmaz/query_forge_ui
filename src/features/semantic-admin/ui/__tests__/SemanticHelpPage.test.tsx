import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SemanticHelpPage from "../SemanticHelpPage";
import { renderSemanticPage } from "./renderSemanticPage";

describe("SemanticHelpPage", () => {
  it("renders the setup guidance and related navigation links", () => {
    renderSemanticPage(<SemanticHelpPage />, { route: "/semantic/help" });

    expect(screen.getByRole("heading", { name: /semantic help/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /recommended setup sequence/i })).toBeInTheDocument();
    expect(screen.getByText(/start with the domain profile/i)).toBeInTheDocument();
    expect(screen.getByText(/run catalog builder after the basics are ready/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^help$/i })).toHaveAttribute("href", "/semantic/help");
    expect(screen.getByRole("link", { name: /catalog builder/i })).toHaveAttribute("href", "/admin/semantic-catalog-builder");
  });
});
