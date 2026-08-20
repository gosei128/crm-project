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

const LoginScreen = () => {
  const [mode, setMode] = useState<string>("login");

  return (
    <main className="w-full h-screen flex justify-center items-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="font-bold text-2xl text-foreground">
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
            <form>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    required
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
                  <Input id="password" type="password" required />
                </div>
              </div>
            </form>
          ) : (
            <form>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center">
                    <Label htmlFor="password">Password</Label>
                  </div>
                  <Input id="password" type="password" required />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center">
                    <Label htmlFor="password">Confirm Password</Label>
                  </div>
                  <Input id="password" type="password" required />
                </div>
              </div>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-2">
          {mode == "login" ? (
            <>
              <Button type="submit" className="w-full">
                Login
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setMode("signup")}
              >
                Sign up
              </Button>
            </>
          ) : (
            <>
              <Button type="submit" className="w-full tt">
                Create Account
              </Button>
              <p
                className="underlined text-xs text-muted-foreground cursor-pointer"
                onClick={() => setMode("login")}
              >
                Already have account?
              </p>
            </>
          )}
        </CardFooter>
      </Card>
    </main>
  );
};

export default LoginScreen;
