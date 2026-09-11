import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/authContext";

// Module-level components (never defined inside other components —
// rerender-no-inline-components). Explicit ternaries for conditional
// rendering (rendering-conditional-render).

export function AuthLoading() {
  return (
    <main
      className="flex h-screen w-full items-center justify-center"
      aria-label="Loading"
      aria-busy="true"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </main>
  );
}

function renderGuard({
  isLoading,
  allowed,
  fallback,
  children,
}: {
  isLoading: boolean;
  allowed: boolean;
  fallback: ReactNode;
  children: ReactNode;
}) {
  // Early exit on the cheap sync state before touching auth-dependent UI.
  if (isLoading) return <AuthLoading />;
  return allowed ? <>{children}</> : <>{fallback}</>;
}

/** Any authenticated user. Unauthenticated → login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  return renderGuard({
    isLoading,
    allowed: user !== null,
    fallback: <Navigate to="/" replace />,
    children,
  });
}

/**
 * Owner workspace. Customers are sent to their dashboard (strict
 * separation), unauthenticated users to login.
 */
export function RequireOwner({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  return renderGuard({
    isLoading,
    allowed: user?.role === "owner",
    fallback: (
      <Navigate to={user !== null ? "/customer" : "/"} replace />
    ),
    children,
  });
}

/**
 * Customer area. Owners are sent to the owner dashboard (strict
 * separation), unauthenticated users to login.
 */
export function RequireCustomer({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  return renderGuard({
    isLoading,
    allowed: user?.role === "customer",
    fallback: (
      <Navigate to={user !== null ? "/dashboard" : "/"} replace />
    ),
    children,
  });
}
