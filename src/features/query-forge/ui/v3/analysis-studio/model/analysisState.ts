import type {
  AnalysisNode,
  AnalysisNodeConfig,
  AnalysisNodeType,
  AnalysisState,
  StudioDomainSummary,
} from "./analysisTypes";
import {
  createDomainRootState,
  deleteNodeAndRelinkLinear,
  getTailNodeId,
  insertNodeAfter,
} from "./analysisUtils";

export type AnalysisAction =
  | { type: "select-node"; nodeId: string | null }
  | { type: "insert-step"; nodeType: AnalysisNodeType; afterNodeId: string | null }
  | { type: "update-node-config"; nodeId: string; config: AnalysisNodeConfig }
  | { type: "delete-node"; nodeId: string }
  | { type: "set-domain"; domain: StudioDomainSummary }
  | { type: "append-step"; nodeType: AnalysisNodeType };

export function analysisReducer(state: AnalysisState, action: AnalysisAction): AnalysisState {
  switch (action.type) {
    case "select-node":
      return {
        ...state,
        selectedNodeId: action.nodeId,
      };
    case "insert-step":
      return insertNodeAfter(state, action.afterNodeId, action.nodeType);
    case "append-step":
      return insertNodeAfter(state, getTailNodeId(state), action.nodeType);
    case "update-node-config": {
      const target = state.nodes[action.nodeId];
      if (!target) return state;
      return {
        ...state,
        nodes: {
          ...state.nodes,
          [action.nodeId]: {
            ...target,
            config: action.config,
          } as AnalysisNode,
        },
      };
    }
    case "delete-node":
      return deleteNodeAndRelinkLinear(state, action.nodeId);
    case "set-domain":
      return createDomainRootState(state, action.domain);
    default:
      return state;
  }
}

export function createInitialAnalysisState(): AnalysisState {
  return {
    nodes: {},
    rootNodeId: null,
    selectedNodeId: null,
    orderedNodeIds: [],
    activeDomainId: null,
  };
}
