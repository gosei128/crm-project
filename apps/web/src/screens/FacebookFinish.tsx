import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthLoading } from "@/components/auth/Guards";
import { useAuth } from "@/lib/authContext";
import { facebookCallbackErrorMessage } from "@/lib/facebookErrors";
import { setToken } from "@/lib/token";

/**
 * Landing page for the backend OAuth callback
 * (/auth/facebook/finish?token=...&role=... or ?error=...).
 * Stores the JWT, syncs the auth context, then replaces history so the
 * token never lingers in the URL bar.
 */
export default function FacebookFinish() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const urlError = facebookCallbackErrorMessage(searchParams.get("error"));
      const token = searchParams.get("token");
      if (urlError || !token) {
        if (!cancelled) setError(urlError ?? "Facebook login failed.");
        return;
      }
      setToken(token);
      const me = await refresh().catch(() => null);
      if (cancelled) return;
      if (!me) {
        setError("Could not verify your session. Please try again.");
        return;
      }
      navigate(me.role === "customer" ? "/customer" : "/dashboard", {
        replace: true,
      });
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [navigate, refresh, searchParams]);

  if (!error) return <AuthLoading />;

  return (
    <main className="flex h-screen w-full items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-xl font-bold">
            Facebook login failed
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button
            className="w-full"
            onClick={() => navigate("/", { replace: true })}
          >
            Back to login
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
