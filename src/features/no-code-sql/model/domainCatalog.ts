// src/shared/model/domainCatalog.ts

export type DomainColumnRef = {
  // stable
  modelColumnId: number | null;
  identityKey: string;

  // display/debug
  columnName: string;              // "paid_amount"
  modelTableName: string;          // "claims_header"
  fullName: string;                // full path from backend
  tableAlias?: string | null;
  columnLabel?: string | null;

  // metadata
  dataType: string;
  nullable: boolean;
  description?: string | null;

  // helpful context
  workspaceTableId: number;
  modelTableId: number;
  baseTableName: string;
  schemaName: string;
  catalogName: string;

  domainId: number;
  domainName: string;

  variantCode?: string | null;
  isQe?: boolean;
  existsInDbx?: boolean;
  lastSeenAt?: string | null;

  ordinalPosition?: number;

  // optional parsed JSON (keep raw too if you want)
  sampleValues?: any | null;
  sampleStats?: any | null;
  sampleRanAt?: string | null;
  sampleError?: string | null;

  tableColumnCount?: number;
};

// FieldRef used by DataPrep / Filters / Aggs / Sorting / Select projection
export type FieldRef =
  | { kind: "column"; workspaceTableId: number; columnName: string; modelColumnId?: number | null }
  | { kind: "computed"; id: string };
