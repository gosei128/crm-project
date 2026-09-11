import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import Signup from "@/components/Signup";
import { login, API_URL } from "@/lib/api";
import { seedUser } from "@/lib/currentUser";
import { setToken } from "@/lib/token";
import { useAuth } from "@/lib/authContext";
import { facebookCallbackErrorMessage } from "@/lib/facebookErrors";
import { useNavigate, useSearchParams } from "react-router-dom";

const LoginScreen = () => {
  const { refresh } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState<string>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  // Backend OAuth failures land back here as ?error=... — surface them.
  const urlError = facebookCallbackErrorMessage(searchParams.get("error"));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    // A stale OAuth ?error= is superseded by this fresh attempt.
    setSearchParams({}, { replace: true });
    try {
      const data = await login(email, password);
      setToken(data.access_token);
      seedUser(data.user ?? null);
      // Sync the auth context BEFORE navigating — the route guards read
      // context state, and navigating with stale (null) state bounces
      // straight back to login.
      const me = await refresh();
      const role = me?.role ?? data.user?.role;
      // Determine redirect based on role from the refreshed session
      if (role === "customer") {
        navigate("/customer");
      } else {
        navigate("/dashboard");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="w-full h-screen flex justify-center items-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="font-bold text-2xl text-accent">
            {mode == "login" ? "Kabarbers — Login" : "Create customer account"}
          </CardTitle>
          <CardDescription className="font-regular text-sm text-secondary-foreground">
            {mode == "login"
              ? "Enter your email below to login. Owner: owner@kabarbers.local"
              : "Create your customer account to book a haircut"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode == "login" ? (
            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center">
                    <Label htmlFor="password">Password</Label>
                    <a
                      href="#"
                      className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                    >
                      Forgot your password?
                    </a>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  {error && <p>{error}</p>}
                  {!error && urlError && <p>{urlError}</p>}
                </div>
              </div>
              <Button
                type="submit"
                className="w-full mt-8 bg-accent hover:bg-accent/90"
                disabled={busy}
              >
                {busy ? "Logging in…" : "Login"}
              </Button>
            </form>
          ) : (
            <Signup onSwitchToLogin={() => setMode("login")} />
          )}
        </CardContent>
        {mode == "login" && (
          <CardFooter className="flex-col gap-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                window.location.href = `${API_URL}/auth/facebook/login`;
              }}
            >
              Continue with Facebook
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setMode("signup")}
            >
              Sign up
            </Button>
          </CardFooter>
        )}
      </Card>
    </main>
  );
};

export default LoginScreen;
