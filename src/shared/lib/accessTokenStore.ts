type TokenListener = (token: string | null) => void;

const STORAGE_KEY = "access_token";
let accessToken: string | null = sessionStorage.getItem(STORAGE_KEY);
const listeners = new Set<TokenListener>();

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  const stored = sessionStorage.getItem(STORAGE_KEY);
  accessToken = stored;
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) {
    sessionStorage.setItem(STORAGE_KEY, token);
  } else {
    sessionStorage.removeItem(STORAGE_KEY);
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
