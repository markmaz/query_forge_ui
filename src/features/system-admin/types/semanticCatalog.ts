export interface SemanticCatalogBuildRequest {
  domain_id: number;
  domain_name?: string;
  dry_run?: boolean;
  table_limit?: number;
  workspace_id?: string;
}

export interface SemanticCatalogBuildRequestBody {
  domain_id: number;
  domain_name?: string;
  dry_run: boolean;
  table_limit: number;
}

export type SemanticCatalogPreviewRow = Record<string, unknown>;

export interface SemanticCatalogBuildResult {
  workspace_id: string | null;
  domain_id: number;
  domain_name: string | null;
  profile_count: number;
  enriched_count: number;
  concepts_upserted: number;
  aliases_upserted: number;
  relationships_upserted: number;
  value_aliases_upserted: number;
  derived_metrics_created: number;
  index_items_count: number;
  dry_run: boolean;
  concept_preview: SemanticCatalogPreviewRow[];
  alias_preview: SemanticCatalogPreviewRow[];
  relationship_preview: SemanticCatalogPreviewRow[];
  index_preview: SemanticCatalogPreviewRow[];
}

export interface SemanticCatalogBuildResponse {
  result: SemanticCatalogBuildResult;
}

export type SemanticCatalogValidationErrors = Record<string, string[]>;
