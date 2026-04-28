import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";

import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const callbackUrl = resolvedSearchParams.callbackUrl ?? "/";
  const session = await getServerSession(authOptions);

  if (session?.user?.role) {
    const defaultPath = session.user.role === "partner" ? "/" : "/sales/new";
    const targetPath =
      callbackUrl.startsWith("/") && callbackUrl !== "/login"
        ? callbackUrl
        : defaultPath;

    redirect(targetPath);
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <LoginForm callbackUrl={callbackUrl} />
      </div>
    </main>
  );
}
