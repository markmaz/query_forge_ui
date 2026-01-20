import type { CohortExtractionEntity, CohortExtractionResult } from '../../../entities/Cohort';

export function toExtractionResult(
  entity: CohortExtractionEntity,
  baseUrl: string,
  workspaceID: string
): CohortExtractionResult {
  return {
    base_url: baseUrl,
    workspace_id: workspaceID,
    entity
  };
}
