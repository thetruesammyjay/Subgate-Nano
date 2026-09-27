import "server-only";

import type {
  AdminAuditEvent,
  AdminCreatorDetail,
  AdminCreatorSummary,
  AdminOverviewData,
  AdminRevenueReport,
  AdminSession,
  AdminSettings,
  AdminSettlement,
  AdminStream,
  CreatorDashboardOverview,
  CreatorReceipt,
  CreatorSettings,
  CreatorWorkspaceSession,
  DashboardPage,
} from "../types/dashboard";
import type { Stream } from "../types/stream";
import { getApiUrl } from "./api-client";

class DashboardRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function dashboardRequest<T>(path: string, token: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}${path}`, {
      cache: "no-store",
      headers: { authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error("The API is unreachable. Check that FastAPI is running and the web API URL is correct.");
  }

  const body = await response.json().catch(() => null) as { detail?: unknown; message?: unknown } | null;
  if (!response.ok) {
    const message = typeof body?.detail === "string"
      ? body.detail
      : typeof body?.message === "string"
        ? body.message
        : `The API returned ${response.status}.`;
    throw new DashboardRequestError(response.status, message);
  }
  return body as T;
}

export async function loadDashboardData<T>(load: () => Promise<T>): Promise<{
  data: T | null;
  error: string | null;
}> {
  try {
    return { data: await load(), error: null };
  } catch (error) {
    if (error instanceof DashboardRequestError && error.status === 401) {
      return { data: null, error: "Your session has expired. Sign out and sign in again." };
    }
    if (error instanceof DashboardRequestError && error.status >= 500) {
      return { data: null, error: "The API could not load this view. Check the API logs and database migrations." };
    }
    return {
      data: null,
      error: error instanceof Error ? error.message : "Dashboard data could not be loaded.",
    };
  }
}

const pageQuery = (limit: number, offset: number, extras?: Record<string, string | undefined>) => {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  for (const [key, value] of Object.entries(extras ?? {})) {
    if (value) query.set(key, value);
  }
  return query.toString();
};

export const getCreatorOverview = (token: string) =>
  dashboardRequest<CreatorDashboardOverview>("/creator/overview", token);

export const getCreatorProfile = (token: string) =>
  dashboardRequest<{
    id: string;
    email: string | null;
    username: string | null;
    display_name: string;
    wallet_address: string | null;
    social_links: Record<string, string>;
    approval_status: CreatorDashboardOverview["approval_status"];
    created_at: string;
  }>("/auth/me", token);

export const getCreatorSettings = (token: string) =>
  dashboardRequest<CreatorSettings>("/creator/settings", token);

export const listCreatorSessions = (token: string, limit = 50) =>
  dashboardRequest<DashboardPage<CreatorWorkspaceSession>>(
    `/creator/sessions?${pageQuery(limit, 0)}`,
    token,
  );

export const listCreatorReceipts = (token: string, limit = 50) =>
  dashboardRequest<DashboardPage<CreatorReceipt>>(
    `/creator/receipts?${pageQuery(limit, 0)}`,
    token,
  );

export const listCreatorStreamsForDashboard = (token: string) =>
  dashboardRequest<Stream[]>("/creator/streams", token);

export const getAdminOverview = (token: string) =>
  dashboardRequest<AdminOverviewData>("/admin/overview", token);

export const listAdminCreators = (
  token: string,
  options: { limit?: number; approvalStatus?: string; q?: string } = {},
) => dashboardRequest<DashboardPage<AdminCreatorSummary>>(
  `/admin/creators?${pageQuery(options.limit ?? 50, 0, {
    approval_status: options.approvalStatus,
    q: options.q,
  })}`,
  token,
);

export const getAdminCreator = (token: string, creatorId: string) =>
  dashboardRequest<AdminCreatorDetail>(`/admin/creators/${encodeURIComponent(creatorId)}`, token);

export const listAdminStreams = (token: string, limit = 50) =>
  dashboardRequest<DashboardPage<AdminStream>>(
    `/admin/streams?${pageQuery(limit, 0)}`,
    token,
  );

export const listAdminSessions = (token: string, limit = 50) =>
  dashboardRequest<DashboardPage<AdminSession>>(
    `/admin/sessions?${pageQuery(limit, 0)}`,
    token,
  );

export const listAdminSettlements = (token: string, limit = 50) =>
  dashboardRequest<DashboardPage<AdminSettlement>>(
    `/admin/settlements?${pageQuery(limit, 0)}`,
    token,
  );

export const listAdminAuditEvents = (token: string, limit = 30) =>
  dashboardRequest<DashboardPage<AdminAuditEvent>>(
    `/admin/audit?${pageQuery(limit, 0)}`,
    token,
  );

export const getAdminRevenueReport = (token: string, days = 30) =>
  dashboardRequest<AdminRevenueReport>(`/admin/reports/revenue?days=${days}`, token);

export const getAdminSettings = (token: string) =>
  dashboardRequest<AdminSettings>("/admin/settings", token);
