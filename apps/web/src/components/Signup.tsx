import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signup, login } from "../lib/api";
import { seedUser } from "../lib/currentUser";
import { setToken } from "../lib/token";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SignupProps {
  onSwitchToLogin?: () => void;
}

const Signup = ({ onSwitchToLogin }: SignupProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await signup(email, password, name);
      // Single-shop: all signups are customers
      const data = await login(email, password);
      setToken(data.access_token);
      seedUser(data.user ?? null);
      navigate("/customer");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signup failed");
    }
  }
  return (
    <form onSubmit={handleSubmit}>
      <div className="flex flex-col gap-6">
        <div className="grid gap-2">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="m@example.com"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" className="w-full">
          Create Account
        </Button>

        {onSwitchToLogin && (
          <p
            className="underlined text-xs text-muted-foreground cursor-pointer text-center"
            onClick={onSwitchToLogin}
          >
            Already have account?
          </p>
        )}
      </div>
    </form>
  );
};

export default Signup;
