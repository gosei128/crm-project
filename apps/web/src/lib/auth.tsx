import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { getMe } from "./api";
import type { User } from "./api";
import { clearToken } from "./token";
import { invalidateUser, loadUser, seedUser } from "./currentUser";
import { AuthContext } from "./authContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadUser()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    invalidateUser();
    setIsLoading(true);
    try {
      const u = await getMe().catch(() => null);
      seedUser(u);
      setUser(u);
      return u;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    invalidateUser();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      // Derived during render, not synced via effect (rerender-derived-state-no-effect).
      role: user?.role ?? null,
      isLoading,
      refresh,
      logout,
    }),
    [user, isLoading, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
