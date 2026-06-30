import "server-only";
import { cookies } from "next/headers";
import type { Creator } from "@subgate/types";
import { getApiUrl } from "./subgate-api";

export const DASHBOARD_SESSION_COOKIE = "subgate_creator_session";

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export type DashboardSession =
  | {
      isAuthenticated: true;
      creator: Creator;
      token: string;
    }
  | {
      isAuthenticated: false;
      creator: null;
      token: null;
    };

export const getDashboardSession = async (): Promise<DashboardSession> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(DASHBOARD_SESSION_COOKIE)?.value;

  if (!token) {
    return {
      isAuthenticated: false,
      creator: null,
      token: null,
    };
  }

  const response = await fetch(`${getApiUrl()}/auth/creator/session`, {
    cache: "no-store",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return {
      isAuthenticated: false,
      creator: null,
      token: null,
    };
  }

  const payload = (await response.json()) as { creator?: Creator };

  if (!payload.creator) {
    return {
      isAuthenticated: false,
      creator: null,
      token: null,
    };
  }

  return {
    isAuthenticated: true,
    creator: payload.creator,
    token,
  };
};

export const getDashboardCookieOptions = () => {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
};
