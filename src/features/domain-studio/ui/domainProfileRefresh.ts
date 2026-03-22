import type { QueryClient } from "@tanstack/react-query";

import {
  generateDomainProfile,
  generateDomainProfilesBatch,
  parseDomainProfileApiError,
} from "@/features/system-admin/api";

export async function refreshDomainProfilesForDomains(
  domainIds: Array<number | null | undefined>,
  queryClient: QueryClient,
): Promise<void> {
  const uniqueIds = Array.from(
    new Set(
      domainIds
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0),
    ),
  );

  if (uniqueIds.length === 0) return;

  try {
    if (uniqueIds.length === 1) {
      await generateDomainProfile(uniqueIds[0], { force: false });
    } else {
      await generateDomainProfilesBatch({
        domain_ids: uniqueIds,
        force: false,
      });
    }
    await queryClient.invalidateQueries({ queryKey: ["admin", "domain-profiles"] });
  } catch (error) {
    throw new Error(
      parseDomainProfileApiError(
        error,
        "Domain saved, but profile refresh failed.",
      ).message,
    );
  }
}
