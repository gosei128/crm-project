import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { login } from "@/lib/api";
import { seedUser } from "@/lib/currentUser";
import { setToken } from "@/lib/token";
import { useAuth } from "@/lib/authContext";
import { useNavigate } from "react-router-dom";

/**
 * Owner/admin login — the only login on the site. Clients book as guests
 * (no account needed), so there is no signup and no customer redirect.
 * Non-owner credentials are rejected even if valid.
 */
const LoginScreen = () => {
  const { refresh, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await login(email, password);
      setToken(data.access_token);
      seedUser(data.user ?? null);
      // Sync the auth context BEFORE navigating — the route guards read
      // context state, and navigating with stale (null) state bounces
      // straight back to login.
      const me = await refresh();
      const role = me?.role ?? data.user?.role;
      if (role !== "owner") {
        // Valid credentials, wrong door: clear the session so a customer
        // token never lingers in this browser.
        logout();
        setError("This login is for the shop owner only.");
        return;
      }
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="w-full min-h-[100dvh] flex justify-center items-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <p className="font-script text-2xl text-brass-deep">Kabarbers</p>
          <CardTitle className="font-display mt-1 text-3xl tracking-wide uppercase">
            Owner Login
          </CardTitle>
          <CardDescription className="font-regular text-sm text-secondary-foreground">
            Shop admin only. Clients book without an account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="owner@kabarbers.local"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
              </div>
            </div>
            <Button
              type="submit"
              className="w-full mt-8 bg-accent-deep text-cream-ink shadow-[0_12px_30px_-10px_rgb(127_29_34/0.6)] hover:bg-oxblood-bright"
              disabled={busy}
            >
              {busy ? "Logging in…" : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
};

export default LoginScreen;
