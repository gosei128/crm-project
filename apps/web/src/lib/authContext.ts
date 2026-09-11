import { createContext, useContext } from "react";
import type { User, UserRole } from "./api";

export interface AuthValue {
  user: User | null;
  role: UserRole | null;
  isLoading: boolean;
  refresh: () => Promise<User | null>;
  logout: () => void;
}

export const AuthContext = createContext<AuthValue>({
  user: null,
  role: null,
  isLoading: true,
  refresh: () => Promise.resolve(null),
  logout: () => {},
});

export function useAuth(): AuthValue {
  return useContext(AuthContext);
}
