import { getCurrentUser } from "./api";
import type { User } from "./api";
import { getToken } from "./token";

// Module-level dedup: concurrent consumers (layout + dashboard + guards)
// share one in-flight /auth/me request instead of firing N identical ones
// (vercel-react-best-practices: client-swr-dedup, async-parallel).
let cachedUser: User | null | undefined;
let inflight: Promise<User | null> | null = null;

export function loadUser(): Promise<User | null> {
  // Cheap sync check before any network work
  // (async-cheap-condition-before-await).
  if (!getToken()) {
    cachedUser = null;
    return Promise.resolve(null);
  }
  if (cachedUser !== undefined) return Promise.resolve(cachedUser);
  if (inflight === null) {
    inflight = getCurrentUser()
      .then((user) => {
        cachedUser = user;
        return user;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Drop the cached user so the next load revalidates (login/logout/role change). */
export function invalidateUser(): void {
  cachedUser = undefined;
}

/** Seed the cache after login/signup so guards render without a refetch. */
export function seedUser(user: User | null): void {
  cachedUser = user;
}
