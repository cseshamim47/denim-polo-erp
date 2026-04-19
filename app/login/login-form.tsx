"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [partnerEmail, setPartnerEmail] = useState("");
  const [salesmanEmail, setSalesmanEmail] = useState("");
  const [salesmanPassword, setSalesmanPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingMode, setLoadingMode] = useState<"partner" | "salesman" | null>(
    null,
  );

  async function handlePartnerLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingMode("partner");
    setError(null);

    const result = await signIn("credentials", {
      mode: "partner",
      email: partnerEmail,
      callbackUrl,
      redirect: false,
    });

    if (!result || result.error) {
      setError("Partner login failed. Use an email from PARTNER_EMAILS.");
      setLoadingMode(null);
      return;
    }

    window.location.href = result.url ?? callbackUrl;
  }

  async function handleSalesmanLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingMode("salesman");
    setError(null);

    const result = await signIn("credentials", {
      mode: "salesman",
      email: salesmanEmail,
      password: salesmanPassword,
      callbackUrl,
      redirect: false,
    });

    if (!result || result.error) {
      setError("Salesman login failed. Check email and password.");
      setLoadingMode(null);
      return;
    }

    window.location.href = result.url ?? callbackUrl;
  }

  return (
    <>
      <section className="panel rounded-4xl p-6 sm:p-8 lg:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.34em] text-(--text-secondary)">
          Denim Polo ERP
        </p>
        <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Real shop flow. No paper guesswork.
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-(--text-secondary)">
          Partners and salesmen sign in from env-controlled credentials. Sales,
          stock, expenses, and returns all land in one ledger.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            [
              "Profit snapshot",
              "Each sale locks average cost and profit at sale time.",
            ],
            [
              "Live stock",
              "Purchase and return flow update variant stock immediately.",
            ],
            [
              "Partner approvals",
              "Expenses stay pending until required partners decide.",
            ],
          ].map(([title, body]) => (
            <div
              key={title}
              className="rounded-3xl border border-(--stroke-soft) bg-white/75 p-4"
            >
              <p className="font-medium text-foreground">{title}</p>
              <p className="mt-2 text-sm leading-6 text-(--text-secondary)">
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel rounded-4xl p-6 sm:p-8 lg:p-10">
        <div className="grid gap-6">
          <form
            className="grid gap-4 rounded-[1.6rem] bg-(--surface-accent) p-5 text-(--text-inverse)"
            onSubmit={handlePartnerLogin}
          >
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/60">
                Partner access
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                Partner email sign-in
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/78">
                Any email listed in PARTNER_EMAILS can sign in as partner for now.
              </p>
            </div>
            <input
              className="field text-foreground"
              autoComplete="email"
              placeholder="partner@example.com"
              type="email"
              value={partnerEmail}
              onChange={(event) => setPartnerEmail(event.target.value)}
            />
            <button className="btn-secondary w-full" disabled={loadingMode !== null} type="submit">
              {loadingMode === "partner" ? "Signing in..." : "Sign in as partner"}
            </button>
          </form>

          <form
            className="grid gap-4 rounded-[1.6rem] bg-white/75 p-5"
            onSubmit={handleSalesmanLogin}
          >
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-(--text-secondary)">
                Salesman access
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                Credentials sign-in
              </h2>
            </div>
            <input
              className="field"
              autoComplete="email"
              placeholder="salesman@shop.com"
              type="email"
              value={salesmanEmail}
              onChange={(event) => setSalesmanEmail(event.target.value)}
            />
            <input
              className="field"
              autoComplete="current-password"
              placeholder="Password"
              type="password"
              value={salesmanPassword}
              onChange={(event) => setSalesmanPassword(event.target.value)}
            />
            <button
              className="btn-primary w-full"
              disabled={loadingMode !== null}
              type="submit"
            >
              {loadingMode === "salesman"
                ? "Signing in..."
                : "Sign in as salesman"}
            </button>
            {error ? <p className="text-sm text-(--danger)">{error}</p> : null}
          </form>
        </div>
      </section>
    </>
  );
}
