import { QueryClient } from "@tanstack/react-query";

const PREVIEW_CACHE_KEY_PATTERNS = [/^query_builder_/, /^cohort_builder_/, /^nocode_/];

const safeStorage = (kind: "localStorage" | "sessionStorage"): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window[kind];
  } catch {
    return null;
  }
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function clearWorkspaceScopedClientCaches() {
  queryClient.clear();

  const storages = [safeStorage("localStorage"), safeStorage("sessionStorage")].filter(
    (s): s is Storage => Boolean(s)
  );

  storages.forEach((storage) => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key) continue;
      if (PREVIEW_CACHE_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => storage.removeItem(key));
  });
}
