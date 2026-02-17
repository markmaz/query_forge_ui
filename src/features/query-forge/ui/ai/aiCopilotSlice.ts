import type { AiCopilotSection, AiSuggestion, QueryStudioSuggestResponse } from "./types";

type AiHistoryEntry = {
  id: string;
  prompt: string;
  responseMessage: string;
  timestamp: string;
  section: AiCopilotSection;
};

export type AiCopilotState = {
  activeSection: AiCopilotSection;
  loading: boolean;
  message: string;
  suggestions: AiSuggestion[];
  history: AiHistoryEntry[];
  expandedSuggestionIds: Record<string, boolean>;
  error: string | null;
};

type AiCopilotAction =
  | { type: "setActiveSection"; section: AiCopilotSection }
  | { type: "requestStart" }
  | { type: "requestSuccess"; response: QueryStudioSuggestResponse; prompt: string }
  | { type: "requestError"; error: string }
  | { type: "requestCancel" }
  | { type: "toggleSuggestion"; suggestionId: string }
  | { type: "clearError" };

const MAX_HISTORY = 10;

export const createInitialAiCopilotState = (
  section: AiCopilotSection = "Domain"
): AiCopilotState => ({
  activeSection: section,
  loading: false,
  message: "",
  suggestions: [],
  history: [],
  expandedSuggestionIds: {},
  error: null,
});

const ensureSuggestionId = (suggestion: AiSuggestion, idx: number): AiSuggestion => ({
  ...suggestion,
  id: suggestion.id ?? `${idx}-${suggestion.title}`,
});

export function aiCopilotReducer(
  state: AiCopilotState,
  action: AiCopilotAction
): AiCopilotState {
  switch (action.type) {
    case "setActiveSection":
      return {
        ...state,
        activeSection: action.section,
      };
    case "requestStart":
      return {
        ...state,
        loading: true,
        error: null,
      };
    case "requestSuccess": {
      const normalizedSuggestions = action.response.suggestions.map(ensureSuggestionId);
      const nextHistory = [
        ...state.history,
        {
          id: `${Date.now()}`,
          prompt: action.prompt,
          responseMessage: action.response.message,
          timestamp: new Date().toISOString(),
          section: state.activeSection,
        },
      ].slice(-MAX_HISTORY);

      return {
        ...state,
        loading: false,
        message: action.response.message,
        suggestions: normalizedSuggestions,
        history: nextHistory,
        expandedSuggestionIds: {},
        error: null,
      };
    }
    case "requestError":
      return {
        ...state,
        loading: false,
        error: action.error,
      };
    case "requestCancel":
      return {
        ...state,
        loading: false,
      };
    case "toggleSuggestion":
      return {
        ...state,
        expandedSuggestionIds: {
          ...state.expandedSuggestionIds,
          [action.suggestionId]: !state.expandedSuggestionIds[action.suggestionId],
        },
      };
    case "clearError":
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
}
