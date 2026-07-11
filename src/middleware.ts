import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/auth/session";

/**
 * Edge middleware guarding the application. It performs a fast, stateless JWT
 * signature/expiry check to gate access; full authorization (role, active
 * state, folder permissions) is enforced again server-side on every action —
 * the middleware is a first line of defense, not the sole one.
 */
const secretKey = new TextEncoder().encode(process.env.AUTH_SECRET ?? "");

const PUBLIC_PATHS = ["/login"];

async function hasValidSession(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const authed = await hasValidSession(req);

  // Unauthenticated users are redirected to login (preserving intended dest).
  if (!authed && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated users should not see the login page.
  if (authed && isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except Next internals, static assets and the API
  // download route (which enforces its own auth and must stream freely).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets/).*)"],
};
