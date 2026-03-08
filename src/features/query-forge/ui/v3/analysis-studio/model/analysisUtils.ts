import type {
  AnalysisNode,
  AnalysisNodeConfigByType,
  AnalysisNodeType,
  AnalysisState,
  CopilotSuggestion,
  DomainOverviewStats,
  FilterCondition,
  FilterConditionNode,
  FilterGroupNode,
  MetricConfig,
  SortConfig,
  StudioDomainExplorer,
  StudioDomainLike,
  StudioDomainSummary,
  StudioField,
  StudioFieldCategory,
  SuggestedNextAction,
} from "./analysisTypes";

export const NODE_TYPE_LABELS: Record<AnalysisNodeType, string> = {
  domain: "Domain",
  filter: "Filter",
  select: "Select Fields",
  group: "Group",
  metric: "Metric",
  sort: "Sort",
  limit: "Limit",
};

const TITLE_CACHE = new Map<string, string>();

export function toTitle(value: string): string {
  if (!value) return "";
  const cached = TITLE_CACHE.get(value);
  if (cached) return cached;
  const titled = value
    .split("_")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
  TITLE_CACHE.set(value, titled);
  return titled;
}

function toDisplayFieldLabel(fieldToken: string): string {
  const leafToken = fieldToken.split(".").filter(Boolean).pop() ?? fieldToken;
  return toTitle(leafToken);
}

function getDomainDisplayName(domain: StudioDomainLike | null | undefined): string {
  return domain?.label ?? "";
}

export function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createFilterCondition(seed?: Partial<FilterCondition>): FilterCondition {
  return {
    id: createId("cond"),
    field: seed?.field ?? "",
    operator: seed?.operator ?? "=",
    value: seed?.value ?? "",
  };
}

export function createFilterConditionNode(seed?: Partial<FilterCondition>): FilterConditionNode {
  const condition = createFilterCondition(seed);
  return {
    ...condition,
    type: "condition",
  };
}

export function createFilterGroupNode(
  seed?: Partial<Pick<FilterGroupNode, "id" | "match">>,
  children?: Array<FilterGroupNode | FilterConditionNode>,
): FilterGroupNode {
  return {
    type: "group",
    id: seed?.id ?? createId("grp"),
    match: seed?.match ?? "and",
    children: children ?? [createFilterConditionNode()],
  };
}

function isFilterConditionNode(value: unknown): value is FilterConditionNode {
  return Boolean(value) && typeof value === "object" && (value as FilterConditionNode).type === "condition";
}

function isFilterGroupNode(value: unknown): value is FilterGroupNode {
  return Boolean(value) && typeof value === "object" && (value as FilterGroupNode).type === "group";
}

function fromLegacyCondition(condition: FilterCondition): FilterConditionNode {
  return {
    type: "condition",
    id: condition.id || createId("cond"),
    field: condition.field ?? "",
    operator: condition.operator ?? "=",
    value: condition.value ?? "",
  };
}

function sanitizeFilterGroupNode(group: FilterGroupNode): FilterGroupNode {
  const children = group.children
    .map((child) => {
      if (isFilterGroupNode(child)) {
        return sanitizeFilterGroupNode(child);
      }
      if (isFilterConditionNode(child)) {
        return {
          ...child,
          id: child.id || createId("cond"),
          field: child.field ?? "",
          operator: child.operator ?? "=",
          value: child.value ?? "",
        };
      }
      return null;
    })
    .filter((child): child is FilterGroupNode | FilterConditionNode => Boolean(child));

  return {
    ...group,
    id: group.id || createId("grp"),
    match: group.match === "or" ? "or" : "and",
    children: children.length > 0 ? children : [createFilterConditionNode()],
  };
}

export function getFilterRoot(config: AnalysisNodeConfigByType["filter"]): FilterGroupNode {
  if (config.root && isFilterGroupNode(config.root)) {
    return sanitizeFilterGroupNode(config.root);
  }

  const legacyConditions = (config.conditions ?? []).map(fromLegacyCondition);
  return createFilterGroupNode(undefined, legacyConditions.length > 0 ? legacyConditions : undefined);
}

export function flattenFilterConditions(root: FilterGroupNode): FilterCondition[] {
  const out: FilterCondition[] = [];
  const walk = (group: FilterGroupNode) => {
    group.children.forEach((child) => {
      if (child.type === "group") {
        walk(child);
        return;
      }
      out.push({
        id: child.id,
        field: child.field,
        operator: child.operator,
        value: child.value,
      });
    });
  };
  walk(root);
  return out;
}

export function toFilterConfig(root: FilterGroupNode): AnalysisNodeConfigByType["filter"] {
  const normalizedRoot = sanitizeFilterGroupNode(root);
  return {
    root: normalizedRoot,
    conditions: flattenFilterConditions(normalizedRoot),
  };
}

export function createMetric(seed?: Partial<MetricConfig>): MetricConfig {
  return {
    id: createId("metric"),
    aggregation: seed?.aggregation ?? "sum",
    field: seed?.field ?? "",
    alias: seed?.alias ?? "",
  };
}

export function createSort(seed?: Partial<SortConfig>): SortConfig {
  return {
    id: createId("sort"),
    field: seed?.field ?? "",
    direction: seed?.direction ?? "desc",
  };
}

export function getDefaultNodeConfig<TType extends AnalysisNodeType>(
  type: TType,
  domain?: StudioDomainLike,
): AnalysisNodeConfigByType[TType] {
  switch (type) {
    case "domain":
      return {
        domainId: domain?.id ?? null,
        domainName: getDomainDisplayName(domain),
        domainKey: domain?.key,
        description: domain?.description ?? undefined,
      } as AnalysisNodeConfigByType[TType];
    case "filter":
      return {
        root: createFilterGroupNode(),
        conditions: [createFilterCondition()],
      } as AnalysisNodeConfigByType[TType];
    case "select":
      return {
        fields: [],
      } as unknown as AnalysisNodeConfigByType[TType];
    case "group":
      return {
        fields: [],
      } as unknown as AnalysisNodeConfigByType[TType];
    case "metric":
      return {
        metrics: [createMetric()],
      } as AnalysisNodeConfigByType[TType];
    case "sort":
      return {
        sorts: [createSort()],
      } as AnalysisNodeConfigByType[TType];
    case "limit":
      return {
        value: 100,
      } as AnalysisNodeConfigByType[TType];
    default:
      return {
        value: 100,
      } as AnalysisNodeConfigByType[TType];
  }
}

export function createNode<TType extends AnalysisNodeType>(type: TType, domain?: StudioDomainLike): AnalysisNode<TType> {
  return {
    id: createId("node"),
    type,
    config: getDefaultNodeConfig(type, domain),
    parentNodeId: null,
    childNodeIds: [],
    position: { x: 0, y: 0 },
  };
}

export function createDomainNode(domain: StudioDomainSummary): AnalysisNode<"domain"> {
  const domainNode = createNode("domain", domain);
  domainNode.parentNodeId = null;
  domainNode.childNodeIds = [];
  return domainNode;
}

export function deriveOrderedPath(nodes: Record<string, AnalysisNode>, rootNodeId: string | null): string[] {
  if (!rootNodeId || !nodes[rootNodeId]) return [];
  const ordered: string[] = [];
  const visited = new Set<string>();

  let currentId: string | null = rootNodeId;
  while (currentId && nodes[currentId] && !visited.has(currentId)) {
    ordered.push(currentId);
    visited.add(currentId);
    currentId = nodes[currentId].childNodeIds[0] ?? null;
  }

  return ordered;
}

export function getOrderedPath(state: AnalysisState): string[] {
  return deriveOrderedPath(state.nodes, state.rootNodeId);
}

export function withOrderedNodeIds(state: AnalysisState): AnalysisState {
  return {
    ...state,
    orderedNodeIds: deriveOrderedPath(state.nodes, state.rootNodeId),
  };
}

export function getTailNodeId(state: AnalysisState): string | null {
  const ordered = state.orderedNodeIds;
  return ordered.length > 0 ? ordered[ordered.length - 1] : null;
}

export function insertNodeAfter(
  state: AnalysisState,
  afterNodeId: string | null,
  nodeType: AnalysisNodeType,
): AnalysisState {
  const nextNodes: Record<string, AnalysisNode> = { ...state.nodes };
  const newNode = createNode(nodeType);

  if (!state.rootNodeId) {
    nextNodes[newNode.id] = newNode;
    return withOrderedNodeIds({
      ...state,
      nodes: nextNodes,
      rootNodeId: newNode.id,
      selectedNodeId: newNode.id,
    });
  }

  if (!afterNodeId) {
    const previousRoot = state.rootNodeId;
    newNode.childNodeIds = [previousRoot];
    nextNodes[newNode.id] = newNode;
    nextNodes[previousRoot] = {
      ...nextNodes[previousRoot],
      parentNodeId: newNode.id,
    };

    return withOrderedNodeIds({
      ...state,
      nodes: nextNodes,
      rootNodeId: newNode.id,
      selectedNodeId: newNode.id,
    });
  }

  const anchor = nextNodes[afterNodeId];
  if (!anchor) {
    return insertNodeAfter(state, getTailNodeId(state), nodeType);
  }

  const existingChildren = [...anchor.childNodeIds];
  newNode.parentNodeId = anchor.id;
  newNode.childNodeIds = existingChildren;

  nextNodes[newNode.id] = newNode;
  nextNodes[anchor.id] = {
    ...anchor,
    childNodeIds: [newNode.id],
  };

  for (const childId of existingChildren) {
    const childNode = nextNodes[childId];
    if (childNode) {
      nextNodes[childId] = {
        ...childNode,
        parentNodeId: newNode.id,
      };
    }
  }

  return withOrderedNodeIds({
    ...state,
    nodes: nextNodes,
    selectedNodeId: newNode.id,
  });
}

export function deleteNodeAndRelinkLinear(state: AnalysisState, nodeId: string): AnalysisState {
  const targetNode = state.nodes[nodeId];
  if (!targetNode) return state;

  const nextNodes: Record<string, AnalysisNode> = { ...state.nodes };
  const parentId = targetNode.parentNodeId;
  const childIds = [...targetNode.childNodeIds];

  if (parentId && nextNodes[parentId]) {
    nextNodes[parentId] = {
      ...nextNodes[parentId],
      childNodeIds: childIds,
    };
  }

  for (const childId of childIds) {
    if (!nextNodes[childId]) continue;
    nextNodes[childId] = {
      ...nextNodes[childId],
      parentNodeId: parentId,
    };
  }

  let nextRootId = state.rootNodeId;
  if (state.rootNodeId === nodeId) {
    nextRootId = childIds[0] ?? null;
    if (nextRootId && nextNodes[nextRootId]) {
      nextNodes[nextRootId] = {
        ...nextNodes[nextRootId],
        parentNodeId: null,
      };
    }
  }

  delete nextNodes[nodeId];

  const fallbackSelected = childIds[0] ?? parentId ?? null;

  return withOrderedNodeIds({
    ...state,
    nodes: nextNodes,
    rootNodeId: nextRootId,
    selectedNodeId: state.selectedNodeId === nodeId ? fallbackSelected : state.selectedNodeId,
  });
}

export function createDomainRootState(state: AnalysisState, domain: StudioDomainSummary): AnalysisState {
  const domainNode = createDomainNode(domain);
  return withOrderedNodeIds({
    ...state,
    nodes: {
      [domainNode.id]: domainNode,
    },
    rootNodeId: domainNode.id,
    selectedNodeId: domainNode.id,
    activeDomainId: domain.id,
  });
}

export function getActionAnchorNodeId(state: AnalysisState): string | null {
  const selectedNodeId = state.selectedNodeId;
  if (selectedNodeId && state.orderedNodeIds.includes(selectedNodeId)) return selectedNodeId;
  return getTailNodeId(state);
}

function createStepAction(nodeType: AnalysisNodeType, label: string, description: string): SuggestedNextAction {
  return {
    id: `action-${nodeType}`,
    kind: "step",
    nodeType,
    label,
    description,
  };
}

function createAskAiAction(promptHint: string): SuggestedNextAction {
  return {
    id: "action-ask-ai",
    kind: "ask_ai",
    label: "Ask AI",
    description: "Let Copilot suggest the next analytical step for this pipeline.",
    promptHint,
  };
}

export function getSuggestedNextActions(
  nodes: Record<string, AnalysisNode>,
  orderedNodeIds: string[],
  selectedNodeId: string | null,
  domainMetadata: StudioDomainLike | null,
): SuggestedNextAction[] {
  if (!orderedNodeIds.length) return [];

  const anchorNodeId = selectedNodeId && orderedNodeIds.includes(selectedNodeId)
    ? selectedNodeId
    : orderedNodeIds[orderedNodeIds.length - 1];

  const anchorNode = nodes[anchorNodeId];
  if (!anchorNode) return [];

  const domainDisplay = getDomainDisplayName(domainMetadata) || "this analysis";
  const askAiPrompt = `Help me choose the next step for ${domainDisplay}.`;

  switch (anchorNode.type) {
    case "domain":
      return [
        createStepAction("filter", "Filter", "Constrain the dataset by dates, entities, or status."),
        createStepAction("select", "Select Fields", "Choose the dimensions and raw fields to project."),
        createStepAction("group", "Group", "Define the main grain for aggregation and comparison."),
        createAskAiAction(askAiPrompt),
      ];
    case "filter":
      return [
        createStepAction("select", "Select Fields", "Project the fields you want to keep after filtering."),
        createStepAction("group", "Group", "Group filtered rows into meaningful segments."),
        createStepAction("metric", "Metric", "Add measures such as SUM, AVG, or COUNT."),
        createAskAiAction(askAiPrompt),
      ];
    case "select":
      return [
        createStepAction("filter", "Filter", "Refine selected rows with additional conditions."),
        createStepAction("group", "Group", "Create grouped slices for comparison."),
        createStepAction("sort", "Sort", "Rank rows by business priority."),
        createAskAiAction(askAiPrompt),
      ];
    case "group":
      return [
        createStepAction("metric", "Metric", "Aggregate grouped rows into KPIs."),
        createStepAction("sort", "Sort", "Order grouped results by relevance."),
        createStepAction("filter", "Filter", "Apply post-group constraints."),
        createAskAiAction(askAiPrompt),
      ];
    case "metric":
      return [
        createStepAction("sort", "Sort", "Order metrics to surface the strongest signals."),
        createStepAction("filter", "Filter", "Refine calculated outputs with additional constraints."),
        createStepAction("limit", "Limit", "Control output size for focused review."),
        createAskAiAction(askAiPrompt),
      ];
    case "sort":
      return [
        createStepAction("limit", "Limit", "Trim results to top N rows."),
        createStepAction("filter", "Filter", "Further narrow sorted outputs."),
        createAskAiAction(askAiPrompt),
      ];
    case "limit":
      return [
        createStepAction("filter", "Filter", "Adjust constraints and iterate quickly."),
        createAskAiAction(askAiPrompt),
      ];
    default:
      return [createAskAiAction(askAiPrompt)];
  }
}

export function getActiveDomainMetadata(domains: StudioDomainSummary[], selectedDomainId: number | null): StudioDomainSummary | null {
  if (!selectedDomainId) return null;
  return domains.find((domain) => domain.id === selectedDomainId) ?? null;
}

export function flattenExplorerFields(explorer: StudioDomainExplorer | null): StudioField[] {
  if (!explorer) return [];
  const byPath = new Map<string, StudioField>();
  explorer.fieldCategories.forEach((category) => {
    category.fields.forEach((field) => {
      const key = field.path.toLowerCase();
      if (!byPath.has(key)) {
        byPath.set(key, field);
      }
    });
  });
  return Array.from(byPath.values());
}

export function getDomainOverviewStats(
  explorer: StudioDomainExplorer | null,
  fallbackDomain: StudioDomainLike | null,
): DomainOverviewStats {
  const domain = explorer?.domain ?? fallbackDomain;
  return {
    categoryCount: explorer?.fieldCategories.length ?? domain?.categoryCount ?? 0,
    fieldCount: flattenExplorerFields(explorer).length || domain?.fieldCount || 0,
    metricCount: domain?.metricCount ?? 0,
  };
}

function fieldMatchesSearch(field: StudioField, categoryLabel: string, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  const aliasBlob = (field.aliases ?? []).join(" ").toLowerCase();
  return (
    field.label.toLowerCase().includes(normalizedQuery)
    || field.path.toLowerCase().includes(normalizedQuery)
    || field.key.toLowerCase().includes(normalizedQuery)
    || categoryLabel.toLowerCase().includes(normalizedQuery)
    || aliasBlob.includes(normalizedQuery)
  );
}

export function searchDomainFields(category: StudioFieldCategory, searchValue: string): StudioField[] {
  const normalized = searchValue.trim().toLowerCase();
  if (!normalized) return category.fields;
  return category.fields.filter((field) => fieldMatchesSearch(field, category.label, normalized));
}

export function getFilteredDomainCategories(explorer: StudioDomainExplorer | null, searchValue: string): StudioFieldCategory[] {
  if (!explorer) return [];
  const normalized = searchValue.trim().toLowerCase();
  if (!normalized) return explorer.fieldCategories;

  return explorer.fieldCategories
    .map((category) => ({
      ...category,
      fields: searchDomainFields(category, normalized),
    }))
    .filter((category) => category.fields.length > 0);
}

export function findExplorerFieldById(explorer: StudioDomainExplorer | null, fieldId: string): StudioField | null {
  if (!explorer || !fieldId) return null;
  const normalized = fieldId.trim().toLowerCase();
  const fields = flattenExplorerFields(explorer);
  return fields.find((field) => String(field.id).toLowerCase() === normalized) ?? null;
}

export function getRecentlyUsedFields(
  explorer: StudioDomainExplorer | null,
  recentFieldIds: string[],
  maxItems = 8,
): StudioField[] {
  if (!explorer || !recentFieldIds.length) return [];

  const byId = new Map(flattenExplorerFields(explorer).map((field) => [String(field.id), field]));
  const rows: StudioField[] = [];
  for (const fieldId of recentFieldIds) {
    const field = byId.get(String(fieldId));
    if (field) rows.push(field);
    if (rows.length >= maxItems) break;
  }
  return rows;
}

function createCopilotSuggestion(
  id: string,
  label: string,
  description: string,
  promptHint?: string,
): CopilotSuggestion {
  return { id, label, description, promptHint };
}

export function getCopilotSuggestions(
  domain: StudioDomainLike | null,
  explorer: StudioDomainExplorer | null,
  suggestedActions: SuggestedNextAction[],
): CopilotSuggestion[] {
  const fromQuestions = (explorer?.domain.exampleQuestions ?? []).map((question, index) =>
    createCopilotSuggestion(
      `question-${index}`,
      question,
      "Use this question to continue analysis planning.",
      question,
    ));

  const fromActions = suggestedActions
    .filter((action) => action.nodeType)
    .map((action) => ({
      id: `${action.id}-copilot`,
      label: action.label,
      description: action.description,
      nodeType: action.nodeType,
      promptHint: action.promptHint,
    }));

  const fallback = domain
    ? [
      createCopilotSuggestion(
        "fallback-next-step",
        `Continue ${domain.label}`,
        "Ask Copilot for the highest-impact next pipeline change.",
        `Suggest the best next step for ${domain.label}.`,
      ),
    ]
    : [];

  const merged = [...fromQuestions, ...fromActions, ...fallback];
  const deduped = new Map<string, CopilotSuggestion>();
  merged.forEach((item) => {
    if (!deduped.has(item.label)) deduped.set(item.label, item);
  });

  return Array.from(deduped.values()).slice(0, 6);
}

function summarizeCondition(condition: FilterCondition): string {
  const field = condition.field ? toDisplayFieldLabel(condition.field) : "Field";
  const value = condition.value?.trim() ? condition.value.trim() : "?";
  return `${field} ${condition.operator} ${value}`;
}

function summarizeFilterGroup(group: FilterGroupNode): string {
  const parts = group.children
    .map((child) => {
      if (child.type === "group") return `(${summarizeFilterGroup(child)})`;
      if (!child.field && !child.value) return "";
      return summarizeCondition(child);
    })
    .filter(Boolean);

  if (parts.length === 0) return "";
  return parts.join(group.match === "or" ? " OR " : " AND ");
}

export function summarizeNode(node: AnalysisNode): string {
  switch (node.type) {
    case "domain": {
      const config = node.config as AnalysisNodeConfigByType["domain"];
      return config.domainName?.trim() || "Select a domain";
    }
    case "filter": {
      const config = node.config as AnalysisNodeConfigByType["filter"];
      const summary = summarizeFilterGroup(getFilterRoot(config));
      return summary || "No filter conditions configured";
    }
    case "select": {
      const config = node.config as AnalysisNodeConfigByType["select"];
      if (!config.fields.length) return "No fields selected";
      return config.fields.map(toDisplayFieldLabel).join(", ");
    }
    case "group": {
      const config = node.config as AnalysisNodeConfigByType["group"];
      if (!config.fields.length) return "No grouping configured";
      return `Group by ${config.fields.map(toDisplayFieldLabel).join(", ")}`;
    }
    case "metric": {
      const config = node.config as AnalysisNodeConfigByType["metric"];
      if (!config.metrics.length) return "No metrics configured";
      return config.metrics
        .map((metric) => {
          const agg = metric.aggregation.toUpperCase();
          const field = metric.field ? toDisplayFieldLabel(metric.field) : "Field";
          const alias = metric.alias?.trim() ? ` as ${metric.alias.trim()}` : "";
          return `${agg}(${field})${alias}`;
        })
        .join(", ");
    }
    case "sort": {
      const config = node.config as AnalysisNodeConfigByType["sort"];
      if (!config.sorts.length) return "No sorting configured";
      return config.sorts
        .map((sort) => `${toDisplayFieldLabel(sort.field || "field")} ${sort.direction.toUpperCase()}`)
        .join(", ");
    }
    case "limit": {
      const config = node.config as AnalysisNodeConfigByType["limit"];
      return `Top ${config.value || 0}`;
    }
    default:
      return "Not configured";
  }
}

export const getStepSummary = summarizeNode;
