import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import type { Role } from "@/lib/constants";
import { SESSION_COOKIE } from "@/lib/auth/session-constants";

export { SESSION_COOKIE };

const secretKey = new TextEncoder().encode(env.AUTH_SECRET);

export interface SessionPayload {
  sub: string; // user id
  name: string;
  email: string;
  role: Role;
}

/** Sign a session JWT valid for SESSION_MAX_AGE seconds. */
export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${env.SESSION_MAX_AGE}s`)
    .sign(secretKey);
}

/** Verify a session JWT, returning its payload or null when invalid/expired. */
export async function verifySession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });
    if (
      typeof payload.sub === "string" &&
      typeof payload.name === "string" &&
      typeof payload.email === "string" &&
      typeof payload.role === "string"
    ) {
      return {
        sub: payload.sub,
        name: payload.name,
        email: payload.email,
        role: payload.role as Role,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Persist the session cookie (httpOnly, SameSite=Lax). */
export async function setSessionCookie(token: string): Promise<void> {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: env.SESSION_MAX_AGE,
  });
}

/** Remove the session cookie (logout). */
export async function clearSessionCookie(): Promise<void> {
  cookies().delete(SESSION_COOKIE);
}

/** Read the raw session payload from the request cookies. */
export async function readSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifySession(token);
}
