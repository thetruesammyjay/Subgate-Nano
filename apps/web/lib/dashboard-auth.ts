import "server-only";

import { cookies } from "next/headers";
import type { Admin, Creator } from "../types/auth";
import { getApiUrl } from "./api-client";

export const CREATOR_SESSION_COOKIE = "subgate_creator_session";
export const ADMIN_SESSION_COOKIE = "subgate_admin_session";
// Kept as an alias for the existing wallet-login route and callers.
export const DASHBOARD_SESSION_COOKIE = CREATOR_SESSION_COOKIE;
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export type DashboardSession =
  | { isAuthenticated: true; creator: Creator; token: string }
  | { isAuthenticated: false; creator: null; token: null };

export const getDashboardToken = async () => {
  const cookieStore = await cookies();
  return cookieStore.get(CREATOR_SESSION_COOKIE)?.value ?? null;
};

export const getDashboardSession = async (): Promise<DashboardSession> => {
  const token = await getDashboardToken();
  if (!token) return { isAuthenticated: false, creator: null, token: null };

  try {
    const response = await fetch(`${getApiUrl()}/auth/me`, {
      cache: "no-store",
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      return { isAuthenticated: false, creator: null, token: null };
    }
    const creator = (await response.json()) as Creator;
    return { isAuthenticated: true, creator, token };
  } catch {
    return { isAuthenticated: false, creator: null, token: null };
  }
};

export const getDashboardCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
});

export type AdminSession =
  | { isAuthenticated: true; admin: Admin; token: string }
  | { isAuthenticated: false; admin: null; token: null };

export const getAdminToken = async () => {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_SESSION_COOKIE)?.value ?? null;
};

export const getAdminSession = async (): Promise<AdminSession> => {
  const token = await getAdminToken();
  if (!token) return { isAuthenticated: false, admin: null, token: null };
  try {
    const response = await fetch(`${getApiUrl()}/auth/admin/me`, {
      cache: "no-store",
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) return { isAuthenticated: false, admin: null, token: null };
    const admin = (await response.json()) as Admin;
    return { isAuthenticated: true, admin, token };
  } catch {
    return { isAuthenticated: false, admin: null, token: null };
  }
};
