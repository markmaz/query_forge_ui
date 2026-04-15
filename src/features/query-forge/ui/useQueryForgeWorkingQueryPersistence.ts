import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";

import type { SqlQueryJson } from "../model/sqlJson";
import type {
  OpenQueryState,
  PersistedQueryPayload,
} from "./queryForgePageTypes";

type UseQueryForgeWorkingQueryPersistenceParams = {
  openQuery: OpenQueryState;
  selectedSavedQueryId: string | undefined;
  sqlJson: SqlQueryJson;
  ensureToolMeta: (next: SqlQueryJson) => SqlQueryJson;
  normalizeSqlJsonPayload: (
    raw: Partial<SqlQueryJson> | null | undefined,
  ) => SqlQueryJson;
  setSqlJson: (value: SqlQueryJson) => void;
  setOpenQuery: Dispatch<SetStateAction<OpenQueryState>>;
  setSelectedSavedQueryId: (value: string | undefined) => void;
};

const persistWorkingQuery = (payload: {
  id: string;
  name: string;
  description?: string | null;
  folderId: string | null;
  isDirty: boolean;
  sqlJson: SqlQueryJson;
}) => {
  if (typeof window === "undefined") return;
  const saved = {
    id: payload.id,
    name: payload.name,
    description: payload.description ?? null,
    folderId: payload.folderId,
    isDirty: payload.isDirty,
    sqlJson: payload.sqlJson,
    savedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(
      `query_builder_working:${payload.id}`,
      JSON.stringify(saved),
    );
    localStorage.setItem("query_builder_working:last", payload.id);
  } catch (err) {
    console.warn("Failed to persist working query locally", err);
  }
};

export function persistSavedQuerySnapshot(payload: PersistedQueryPayload) {
  if (typeof window === "undefined") return;
  const saved = {
    id: payload.id,
    name: payload.name,
    description: payload.description ?? null,
    folderId: payload.folderId,
    sqlJson: payload.sqlJson,
    savedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(
      `query_builder_saved:${payload.id}`,
      JSON.stringify(saved),
    );
  } catch (err) {
    console.warn("Failed to persist query locally", err);
  }
}

export function useQueryForgeWorkingQueryPersistence({
  openQuery,
  selectedSavedQueryId,
  sqlJson,
  ensureToolMeta,
  normalizeSqlJsonPayload,
  setSqlJson,
  setOpenQuery,
  setSelectedSavedQueryId,
}: UseQueryForgeWorkingQueryPersistenceParams) {
  const workingHydratedRef = useRef(false);
  const persistTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (workingHydratedRef.current) return;
    if (selectedSavedQueryId) return;

    const lastId =
      localStorage.getItem("query_builder_working:last") || "draft";
    const raw = localStorage.getItem(`query_builder_working:${lastId}`);
    if (!raw) {
      workingHydratedRef.current = true;
      return;
    }

    try {
      const saved = JSON.parse(raw);
      const savedSql = saved?.sqlJson
        ? ensureToolMeta(normalizeSqlJsonPayload(saved.sqlJson))
        : null;
      if (savedSql) setSqlJson(savedSql);
      setOpenQuery((prev) => ({
        ...prev,
        id: lastId !== "draft" ? lastId : null,
        name: saved?.name ?? prev.name,
        description: saved?.description ?? null,
        folderId: saved?.folderId ?? null,
        isDirty: saved?.isDirty ?? true,
      }));
      if (lastId !== "draft") setSelectedSavedQueryId(lastId);
    } catch (err) {
      console.warn("Failed to restore working query", err);
    } finally {
      workingHydratedRef.current = true;
    }
  }, [
    ensureToolMeta,
    normalizeSqlJsonPayload,
    selectedSavedQueryId,
    setOpenQuery,
    setSelectedSavedQueryId,
    setSqlJson,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);

    persistTimerRef.current = window.setTimeout(() => {
      const workingId = openQuery.id ?? "draft";
      persistWorkingQuery({
        id: workingId,
        name: openQuery.name ?? "New Query",
        description: openQuery.description ?? null,
        folderId: openQuery.folderId ?? null,
        isDirty: openQuery.isDirty,
        sqlJson: ensureToolMeta(sqlJson),
      });
    }, 400);

    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    };
  }, [ensureToolMeta, openQuery, sqlJson]);
}
