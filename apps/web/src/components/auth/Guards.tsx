import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/authContext";

// Module-level components (never defined inside other components —
// rerender-no-inline-components). Explicit ternaries for conditional
// rendering (rendering-conditional-render).

export function AuthLoading() {
  return (
    <main
      className="flex min-h-[100dvh] w-full items-center justify-center"
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

/**
 * Owner/admin workspace. Only the owner role is allowed — everyone else
 * (including customer-role accounts and guests) goes to the owner login,
 * which itself rejects non-owner credentials.
 */
export function RequireOwner({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  return renderGuard({
    isLoading,
    allowed: user?.role === "owner",
    fallback: <Navigate to="/login" replace />,
    children,
  });
}
