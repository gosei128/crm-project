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
import { login } from "@/lib/api";
import { useNavigate } from "react-router-dom";

const LoginScreen = () => {
  const [mode, setMode] = useState<string>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const data = await login(email, password);
      localStorage.setItem("token", data.access_token);
      navigate("/dashboard");
    } catch (e: any) {
      setError(e.message);
    }
  };
  return (
    <main className="w-full h-screen flex justify-center items-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="font-bold text-2xl text-accent">
            {mode == "login" ? "Login to your account" : "Create your account"}
          </CardTitle>
          <CardDescription className="font-regular text-sm text-secondary-foreground">
            {mode == "login"
              ? "Enter your email below to login to your account"
              : "Create your account by filling out all the fields"}
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
                </div>
              </div>
              <Button
                type="submit"
                className="w-full mt-8 bg-accent hover:bg-accent/90"
              >
                Login
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
