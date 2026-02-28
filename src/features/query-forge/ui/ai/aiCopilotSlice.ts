import type {
  AiCopilotSection,
  AiSuggestion,
  PlannerResultMetadata,
  QueryStudioSuggestResponse,
} from "./types";

type AiHistoryEntry = {
  id: string;
  prompt: string;
  responseMessage: string;
  timestamp: string;
  section: AiCopilotSection;
  suggestions: AiSuggestion[];
  plannerMeta: PlannerResultMetadata | null;
  confidence?: number;
  rawResponse?: unknown;
};

export type AiCopilotState = {
  activeSection: AiCopilotSection;
  loading: boolean;
  message: string;
  suggestions: AiSuggestion[];
  history: AiHistoryEntry[];
  expandedSuggestionIds: Record<string, boolean>;
  error: string | null;
  plannerMeta: PlannerResultMetadata | null;
};

type AiCopilotAction =
  | { type: "setActiveSection"; section: AiCopilotSection }
  | { type: "requestStart" }
  | { type: "requestSuccess"; response: QueryStudioSuggestResponse; prompt: string }
  | { type: "requestError"; error: string }
  | { type: "requestCancel" }
  | { type: "clearHistory" }
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
  plannerMeta: null,
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
        plannerMeta: null,
      };
    case "requestSuccess": {
      const historyEntryId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const normalizedSuggestions = action.response.suggestions.map((suggestion, idx) => {
        const ensured = ensureSuggestionId(suggestion, idx);
        return {
          ...ensured,
          id: `${historyEntryId}-${ensured.id}`,
        };
      });
      const nextHistory = [
        ...state.history,
        {
          id: historyEntryId,
          prompt: action.prompt,
          responseMessage: action.response.message,
          timestamp: new Date().toISOString(),
          section: state.activeSection,
          suggestions: normalizedSuggestions,
          plannerMeta: action.response.plannerMeta ?? null,
          confidence: action.response.confidence,
          rawResponse: action.response.rawResponse,
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
        plannerMeta: action.response.plannerMeta ?? null,
      };
    }
    case "requestError":
      return {
        ...state,
        loading: false,
        error: action.error,
        plannerMeta: null,
      };
    case "requestCancel":
      return {
        ...state,
        loading: false,
      };
    case "clearHistory":
      return {
        ...state,
        loading: false,
        message: "",
        suggestions: [],
        history: [],
        expandedSuggestionIds: {},
        error: null,
        plannerMeta: null,
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
