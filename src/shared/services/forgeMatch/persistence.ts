import type {
  ForgeMatchPipelineMapping,
  ForgeMatchPipelineSourceRecord,
  ForgeMatchPipelineSummary,
  ForgeMatchSession,
} from "./contracts";

type ForgeMatchSessionStoreEntry = {
  session: ForgeMatchSession;
  source_records: ForgeMatchPipelineSourceRecord[];
  results: ForgeMatchPipelineMapping[];
  summary: ForgeMatchPipelineSummary;
};

type ForgeMatchStore = {
  sessions: Record<string, ForgeMatchSessionStoreEntry>;
};

const STORAGE_KEY = "qf.forgematch.sessions.v1";

const EMPTY_SUMMARY: ForgeMatchPipelineSummary = {
  total: 0,
  matched: 0,
  ambiguous: 0,
  no_confident_match: 0,
  accepted: 0,
  rejected: 0,
  needs_review: 0,
};

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function parseStore(value: string | null): ForgeMatchStore {
  if (!value) return { sessions: {} };
  try {
    const parsed = JSON.parse(value) as ForgeMatchStore | null;
    if (!parsed || typeof parsed !== "object" || !parsed.sessions || typeof parsed.sessions !== "object") {
      return { sessions: {} };
    }
    return parsed;
  } catch {
    return { sessions: {} };
  }
}

function readStore(): ForgeMatchStore {
  const storage = getLocalStorage();
  if (!storage) return { sessions: {} };
  return parseStore(storage.getItem(STORAGE_KEY));
}

function writeStore(next: ForgeMatchStore): void {
  const storage = getLocalStorage();
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function getEmptyForgeMatchSummary(): ForgeMatchPipelineSummary {
  return { ...EMPTY_SUMMARY };
}

export function upsertForgeMatchSessionEntry(entry: ForgeMatchSessionStoreEntry): void {
  const store = readStore();
  store.sessions[entry.session.id] = entry;
  writeStore(store);
}

export function getForgeMatchSessionEntry(sessionId: string): ForgeMatchSessionStoreEntry | null {
  const normalized = String(sessionId ?? "").trim();
  if (!normalized) return null;
  const store = readStore();
  return store.sessions[normalized] ?? null;
}

export function patchForgeMatchSessionEntry(
  sessionId: string,
  patch: Partial<ForgeMatchSessionStoreEntry>
): ForgeMatchSessionStoreEntry | null {
  const normalized = String(sessionId ?? "").trim();
  if (!normalized) return null;
  const store = readStore();
  const existing = store.sessions[normalized];
  if (!existing) return null;
  const next: ForgeMatchSessionStoreEntry = {
    ...existing,
    ...patch,
    session: {
      ...existing.session,
      ...(patch.session ?? {}),
    },
  };
  store.sessions[normalized] = next;
  writeStore(store);
  return next;
}
