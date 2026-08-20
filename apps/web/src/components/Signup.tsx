import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signup } from "../lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SignupProps {
  onSwitchToLogin?: () => void;
}

const Signup = ({ onSwitchToLogin }: SignupProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"owner" | "customer">("owner");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await signup(email, password, name, role);
      navigate("/login");
    } catch (err: any) {
      setError(err.message);
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
        <div className="grid gap-2">
          <Label>Role</Label>
          <Select
            value={role}
            onValueChange={(v) => setRole(v as "owner" | "customer")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="owner">Business owner</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
            </SelectContent>
          </Select>
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
