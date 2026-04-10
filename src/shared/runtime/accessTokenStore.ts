type TokenListener = (token: string | null) => void;

let accessToken: string | null = null;
const listeners = new Set<TokenListener>();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  listeners.forEach((cb) => cb(accessToken));
}

export function clearAccessToken() {
  setAccessToken(null);
}

export function subscribeAccessToken(cb: TokenListener) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
