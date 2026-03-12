export type AnalysisNodeType = "domain" | "filter" | "select" | "group" | "metric" | "sort" | "limit";

export type FilterOperator = "=" | "!=" | ">" | ">=" | "<" | "<=" | "contains";

export type MetricAggregation = "sum" | "avg" | "count" | "min" | "max";

export type SortDirection = "asc" | "desc";

export type AnalysisNodePosition = {
  x: number;
  y: number;
};

export type FilterCondition = {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
};

export type FilterConditionNode = FilterCondition & {
  type: "condition";
};

export type FilterGroupNode = {
  type: "group";
  id: string;
  match: "and" | "or";
  children: Array<FilterGroupNode | FilterConditionNode>;
};

export type MetricConfig = {
  id: string;
  aggregation: MetricAggregation;
  field: string;
  alias: string;
};

export type SortConfig = {
  id: string;
  field: string;
  direction: SortDirection;
};

export type LimitConfig = {
  value: number;
};

export type DomainNodeConfig = {
  domainId: number | null;
  domainName: string;
  domainKey?: string;
  description?: string;
};

export type FilterNodeConfig = {
  root: FilterGroupNode;
  // kept for backward compatibility with older in-memory configs
  conditions?: FilterCondition[];
};

export type SelectNodeConfig = {
  fields: string[];
};

export type GroupNodeConfig = {
  fields: string[];
};

export type MetricNodeConfig = {
  metrics: MetricConfig[];
};

export type SortNodeConfig = {
  sorts: SortConfig[];
};

export type LimitNodeConfig = LimitConfig;

export type AnalysisNodeConfigByType = {
  domain: DomainNodeConfig;
  filter: FilterNodeConfig;
  select: SelectNodeConfig;
  group: GroupNodeConfig;
  metric: MetricNodeConfig;
  sort: SortNodeConfig;
  limit: LimitNodeConfig;
};

export type AnalysisNodeConfig = AnalysisNodeConfigByType[AnalysisNodeType];

export type AnalysisNode<TType extends AnalysisNodeType = AnalysisNodeType> = {
  id: string;
  type: TType;
  config: AnalysisNodeConfigByType[TType];
  parentNodeId: string | null;
  childNodeIds: string[];
  position?: AnalysisNodePosition;
};

export type AnalysisState = {
  nodes: Record<string, AnalysisNode>;
  rootNodeId: string | null;
  selectedNodeId: string | null;
  orderedNodeIds: string[];
  activeDomainId: number | null;
};

export type AnalysisNodeInsert = {
  nodeType: AnalysisNodeType;
  afterNodeId: string | null;
};

export type StudioDomainSummary = {
  id: number;
  key: string;
  label: string;
  description?: string | null;
  fieldCount?: number;
  categoryCount?: number;
  metricCount?: number;
};

export type StudioDomainDetails = StudioDomainSummary & {
  exampleQuestions?: string[];
};

export type StudioField = {
  id: number | string;
  key: string;
  label: string;
  path: string;
  dataType?: string;
  aliases?: string[];
  allowedAggregations?: string[];
};

export type StudioFieldCategory = {
  id: string;
  label: string;
  fields: StudioField[];
};

export type StudioDomainExplorer = {
  domain: StudioDomainDetails;
  recommendedFields: StudioField[];
  fieldCategories: StudioFieldCategory[];
};

export type DomainOverviewStats = {
  categoryCount: number;
  fieldCount: number;
  metricCount: number;
};

export type StudioDomainLike = Pick<StudioDomainSummary, "id" | "key" | "label"> & {
  description?: string | null;
  fieldCount?: number;
  categoryCount?: number;
  metricCount?: number;
  exampleQuestions?: string[];
};

export type CopilotSuggestion = {
  id: string;
  label: string;
  description: string;
  nodeType?: AnalysisNodeType;
  promptHint?: string;
};

export type SuggestedNextAction = {
  id: string;
  label: string;
  description: string;
  nodeType?: AnalysisNodeType;
  kind: "step" | "ask_ai";
  promptHint?: string;
};

export type StudioResultTab = "results" | "sql" | "explain";
