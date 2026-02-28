import { describe, expect, it } from "vitest";

import { aiCopilotReducer, createInitialAiCopilotState } from ".././aiCopilotSlice";

describe("aiCopilotReducer", () => {
  it("tracks active section changes", () => {
    const initial = createInitialAiCopilotState("Domain");
    const next = aiCopilotReducer(initial, { type: "setActiveSection", section: "Filters" });
    expect(next.activeSection).toBe("Filters");
  });

  it("keeps only the last 10 history entries", () => {
    let state = createInitialAiCopilotState("Columns");

    for (let idx = 0; idx < 12; idx += 1) {
      state = aiCopilotReducer(state, {
        type: "requestSuccess",
        prompt: `prompt-${idx}`,
        response: {
          message: `message-${idx}`,
          suggestions: [],
        },
      });
    }

    expect(state.history).toHaveLength(10);
    expect(state.history[0].prompt).toBe("prompt-2");
    expect(state.history[9].prompt).toBe("prompt-11");
  });

  it("toggles suggestion review state", () => {
    let state = createInitialAiCopilotState("Results");
    state = aiCopilotReducer(state, {
      type: "requestSuccess",
      prompt: "explain",
      response: {
        message: "done",
        suggestions: [
          {
            id: "s1",
            title: "Suggestion",
            why: "Because",
            confidence: "high",
            actions: [],
          },
        ],
      },
    });

    state = aiCopilotReducer(state, { type: "toggleSuggestion", suggestionId: "s1" });
    expect(state.expandedSuggestionIds.s1).toBe(true);

    state = aiCopilotReducer(state, { type: "toggleSuggestion", suggestionId: "s1" });
    expect(state.expandedSuggestionIds.s1).toBe(false);
  });
});
