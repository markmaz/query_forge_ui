export type DomainColumnRef = {
  modelColumnId: number | null;
  identityKey: string;

  columnName: string;
  modelTableName: string;
  fullName: string;
  tableAlias?: string | null;
  columnLabel?: string | null;

  dataType: string;
  nullable: boolean;
  description?: string | null;

  workspaceTableId: number;
  modelTableId: number | null;
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

  sampleValues?: any | null;
  sampleStats?: any | null;
  sampleRanAt?: string | null;
  sampleError?: string | null;

  tableColumnCount?: number;
};

type ColumnFieldRef = {
  kind: "column";
  workspaceTableId: number;
  columnName: string;
  modelColumnId?: number | null;
};

type ComputedFieldRef = {
  kind: "computed";
  id: string;
};

export type FieldRef = ColumnFieldRef | ComputedFieldRef;
