// Versioned auth-token storage (see vercel-react-best-practices:
// client-localstorage-schema + js-cache-storage).
//
// The `v1` suffix lets us evolve the schema without colliding with stale
// or foreign values. Reads are cached in memory; the cache is invalidated
// on `storage` events so concurrent tabs stay in sync.

const TOKEN_KEY = "kabarbers.token:v1";
const LEGACY_KEY = "token";

let cached: string | null | undefined;

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string | null): void {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // Private browsing / quota / disabled storage — auth simply won't persist.
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === TOKEN_KEY || e.key === LEGACY_KEY || e.key === null) {
      cached = undefined;
    }
  });
}

export function getToken(): string | null {
  if (cached !== undefined) return cached;
  let token = readRaw(TOKEN_KEY);
  if (token === null) {
    // One-time migration from the unversioned key.
    token = readRaw(LEGACY_KEY);
    if (token !== null) {
      writeRaw(TOKEN_KEY, token);
      writeRaw(LEGACY_KEY, null);
    }
  }
  cached = token;
  return token;
}

export function setToken(token: string): void {
  cached = token;
  writeRaw(TOKEN_KEY, token);
  writeRaw(LEGACY_KEY, null);
}

export function clearToken(): void {
  cached = null;
  writeRaw(TOKEN_KEY, null);
  writeRaw(LEGACY_KEY, null);
}
