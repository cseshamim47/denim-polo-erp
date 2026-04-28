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
    <main className="flex min-h-screen items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
      <LoginForm callbackUrl={callbackUrl} />
    </main>
  );
}
