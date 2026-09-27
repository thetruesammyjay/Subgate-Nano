import type { ApiErrorPayload } from "../types/api";
import type { AuthChallenge, AuthResponse, Creator } from "../types/auth";
import type {
  CreateStreamPayload,
  Stream,
  UpdateStreamPayload,
} from "../types/stream";

const DEFAULT_API_URL = "http://127.0.0.1:8000";

export const getApiUrl = () =>
  (process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  payload: ApiErrorPayload | null;

  constructor(status: number, payload: ApiErrorPayload | null) {
    super(
      payload?.detail ??
        payload?.message ??
        payload?.error ??
        `Subgate API request failed with status ${status}.`,
    );
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

const parsePayload = async (response: Response) => {
  if (response.status === 204) return null;
  return (await response.json().catch(() => null)) as unknown;
};

export const apiFetch = async <T>(
  path: string,
  init: RequestInit = {},
): Promise<T> => {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${getApiUrl()}${path}`, {
    ...init,
    headers,
    cache: init.cache ?? "no-store",
  });
  const payload = await parsePayload(response);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload && typeof payload === "object"
        ? (payload as ApiErrorPayload)
        : null,
    );
  }

  return payload as T;
};

const authHeaders = (token: string) => ({
  authorization: `Bearer ${token}`,
});

export const createAuthChallenge = (walletAddress: string) =>
  apiFetch<AuthChallenge>("/auth/challenge", {
    method: "POST",
    body: JSON.stringify({ wallet_address: walletAddress }),
  });

export const verifyAuthChallenge = (payload: {
  challenge_id: string;
  wallet_address: string;
  signature: string;
  display_name?: string;
}) =>
  apiFetch<AuthResponse>("/auth/verify", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getCreator = (token: string) =>
  apiFetch<Creator>("/auth/me", {
    headers: authHeaders(token),
  });

export const listStreams = () => apiFetch<Stream[]>("/streams");

export const getStream = (slug: string) =>
  apiFetch<Stream>(`/streams/${encodeURIComponent(slug)}`);

export const listCreatorStreams = (token: string) =>
  apiFetch<Stream[]>("/creator/streams", {
    headers: authHeaders(token),
  });

export const createStream = (token: string, payload: CreateStreamPayload) =>
  apiFetch<Stream>("/streams", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

export const updateStream = (
  token: string,
  streamId: string,
  payload: UpdateStreamPayload,
) =>
  apiFetch<Stream>(`/creator/streams/${streamId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

export const unpublishStream = (token: string, streamId: string) =>
  apiFetch<void>(`/creator/streams/${streamId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
