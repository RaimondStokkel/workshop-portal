"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type LoginFormProps = {
  returnUrl: string;
};

export function LoginForm({ returnUrl }: LoginFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Unable to sign in." }));
        setError(typeof payload?.error === "string" ? payload.error : "Unable to sign in.");
        return;
      }

      router.replace(returnUrl || "/");
      router.refresh();
    } catch (submitError) {
      console.error(submitError);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-slate-100">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-white/10 bg-slate-900/70 p-6 shadow-xl">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold text-lime-300">Workshop Portal Access</h1>
          <p className="text-sm text-slate-300">Enter the access password configured by the administrator.</p>
        </header>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-slate-300">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-lime-400 focus:outline-none"
              autoComplete="current-password"
              required
            />
          </label>
          {error ? <p className="text-sm text-red-200">{error}</p> : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-lime-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:bg-lime-600/40"
          >
            {isSubmitting ? "Verifying..." : "Sign In"}
          </button>
        </form>
        <p className="text-xs text-slate-400">
          Access is restricted to workshop participants. Contact the administrator if you do not have the password.
        </p>
      </div>
    </main>
  );
}
