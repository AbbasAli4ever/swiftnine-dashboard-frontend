import { NextRequest, NextResponse } from "next/server";

// Routes that require the user to be logged in
const PROTECTED_PREFIXES = ["/"];

// Auth routes — logged-in users should be redirected away from these
const AUTH_ROUTES = ["/signin", "/signup"];

// Routes that are always public AND must never be intercepted regardless of session
const PUBLIC_PREFIXES = [
  "/signin",
  "/signup",
  "/forgot-password",
  "/verify-otp",
  "/reset-password",
  "/auth/callback", // Google OAuth lands here with refresh_token already set
  "/error-404",
];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some((p) => pathname.startsWith(p));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always let public routes through — never redirect them
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // The httpOnly refresh_token cookie is set by the backend on login/register/OAuth.
  const hasSession = req.cookies.has("refresh_token");

  // If user is logged in and tries to visit signin/signup → redirect to dashboard
  if (hasSession && isAuthRoute(pathname)) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // If user is NOT logged in and tries to visit a protected route → redirect to signin
  if (!hasSession) {
    const signinUrl = new URL("/signin", req.url);
    signinUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(signinUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: ["/((?!_next/static|_next/image|images|favicon.ico).*)"],
};
