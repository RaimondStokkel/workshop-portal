import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AUTH_COOKIE_NAME, getPasswordDigest, isPasswordConfigured } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";

type LoginPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function sanitizeReturnUrl(rawValue: string | string[] | undefined): string {
  if (typeof rawValue !== "string") {
    return "/";
  }

  if (!rawValue.startsWith("/") || rawValue.startsWith("//")) {
    return "/";
  }

  return rawValue;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (!isPasswordConfigured()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-slate-100">
        <div className="w-full max-w-md space-y-4 rounded-xl border border-white/10 bg-slate-900/70 p-6 text-center shadow-xl">
          <h1 className="text-xl font-semibold text-lime-300">Portal Unavailable</h1>
          <p className="text-sm text-slate-300">
            The access password has not been configured. Update the application settings with
            <span className="font-semibold"> WORKSHOP_PORTAL_PASSWORD</span> and redeploy the site.
          </p>
        </div>
      </main>
    );
  }

  const configuredDigest = await getPasswordDigest();
  const existingCookie = cookies().get(AUTH_COOKIE_NAME);
  if (existingCookie?.value === configuredDigest) {
    redirect("/");
  }

  const returnUrl = sanitizeReturnUrl(searchParams?.returnUrl);

  return <LoginForm returnUrl={returnUrl} />;
}
