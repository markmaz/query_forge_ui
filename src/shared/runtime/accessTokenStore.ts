type TokenListener = (token: string | null) => void;

const STORAGE_KEY = "access_token";
const getStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

let accessToken: string | null = getStorage()?.getItem(STORAGE_KEY) ?? null;
const listeners = new Set<TokenListener>();

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  const stored = getStorage()?.getItem(STORAGE_KEY) ?? null;
  accessToken = stored;
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  const storage = getStorage();

  if (token) {
    storage?.setItem(STORAGE_KEY, token);
  } else {
    storage?.removeItem(STORAGE_KEY);
  }
  listeners.forEach((cb) => cb(accessToken));
}

export function clearAccessToken() {
  setAccessToken(null);
}

export function subscribeAccessToken(cb: TokenListener) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
