import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const partnerOnlyPrefixes = [
  "/",
  "/products",
  "/purchases",
  "/approvals",
  "/expenses",
  "/investments",
  "/assets",
  "/returns",
  "/reports",
  "/api/purchases",
  "/api/approvals",
  "/api/expenses",
  "/api/returns",
  "/api/dashboard",
  "/api/investments",
  "/api/assets",
  "/api/uploadthing",
];

const authRequiredPrefixes = [
  "/sales",
  "/settings",
  "/api/settings",
  "/api/sales",
  "/api/products",
  "/api/variants",
  ...partnerOnlyPrefixes,
];

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default withAuth(
  function proxy(request) {
    const pathname = request.nextUrl.pathname;
    const role = request.nextauth.token?.role;

    if (matchesPrefix(pathname, partnerOnlyPrefixes) && role !== "partner") {
      return NextResponse.redirect(new URL("/sales/new", request.url));
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/login",
    },
    callbacks: {
      authorized: ({ req, token }) => {
        const pathname = req.nextUrl.pathname;

        if (pathname.startsWith("/api/auth")) {
          return true;
        }

        if (!matchesPrefix(pathname, authRequiredPrefixes)) {
          return true;
        }

        return Boolean(token?.role);
      },
    },
  },
);

export const config = {
  matcher: [
    "/",
    "/sales/:path*",
    "/products/:path*",
    "/purchases/:path*",
    "/approvals/:path*",
    "/expenses/:path*",
    "/investments/:path*",
    "/assets/:path*",
    "/settings/:path*",
    "/returns/:path*",
    "/reports/:path*",
    "/api/:path*",
  ],
};
