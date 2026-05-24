"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingMode, setLoadingMode] = useState<"partner" | "credentials" | null>(null);

  async function handlePartnerLogin() {
    setLoadingMode("partner");
    setError(null);

    await signIn("google", { callbackUrl });
  }

  async function handleCredentialsLogin(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setLoadingMode("credentials");
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl,
      redirect: false,
    });

    if (!result || result.error) {
      setError("Sign-in failed. Check email and password.");
      setLoadingMode(null);
      return;
    }

    window.location.href = result.url ?? callbackUrl;
  }

  return (
    <section className="panel w-full max-w-xl rounded-4xl p-6 sm:p-8 lg:p-10">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.34em] text-(--text-secondary)">
          Denim Polo ERP
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Sign in
        </h1>
      </div>

      <div className="grid gap-6">
        <div className="grid gap-6">
          <div className="grid gap-4 rounded-[1.6rem] bg-(--surface-accent) p-5 text-(--text-inverse)">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/60">
                Partner access
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                Google partner sign-in
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/78">
                Only Google accounts listed in PARTNER_EMAILS can enter the
                partner panel. Partners can also sign in with email and
                password after setup.
              </p>
            </div>
            <Button
              className="w-full rounded-full border-white/20 bg-white/10 text-white hover:bg-white/15"
              disabled={loadingMode !== null}
              onClick={() => void handlePartnerLogin()}
              type="button"
            >
              {loadingMode === "partner"
                ? "Redirecting to Google..."
                : "Continue with Google"}
            </Button>
          </div>

          <form
            className="grid gap-4 rounded-[1.6rem] bg-white/75 p-5"
            onSubmit={handleCredentialsLogin}
          >
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-(--text-secondary)">
                Password access
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                Email and password
              </h2>
              <p className="mt-3 text-sm leading-6 text-(--text-secondary)">
                Partners and salesmen can both sign in here with their saved
                password.
              </p>
            </div>
            <Input
              className="field h-auto rounded-2xl px-4 py-3"
              autoComplete="email"
              placeholder="name@shop.com"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Input
              className="field h-auto rounded-2xl px-4 py-3"
              autoComplete="current-password"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button
              className="w-full rounded-full"
              disabled={loadingMode !== null}
              type="submit"
            >
              {loadingMode === "credentials"
                ? "Signing in..."
                : "Sign in with password"}
            </Button>
            {error ? <p className="text-sm text-(--danger)">{error}</p> : null}
          </form>
        </div>
      </div>
    </section>
  );
}
