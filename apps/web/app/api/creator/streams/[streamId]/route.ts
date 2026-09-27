import { NextResponse } from "next/server";
import { getDashboardToken } from "../../../../../lib/dashboard-auth";
import { getApiUrl } from "../../../../../lib/api-client";

const forward = async (
  request: Request,
  streamId: string,
  method: "PATCH" | "DELETE",
) => {
  const token = await getDashboardToken();
  if (!token) return NextResponse.json({ message: "Not authenticated." }, { status: 401 });

  const init: RequestInit = {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(method === "PATCH" ? { "content-type": "application/json" } : {}),
    },
  };
  if (method === "PATCH") init.body = await request.text();
  const response = await fetch(`${getApiUrl()}/creator/streams/${streamId}`, init);
  if (response.status === 204) return new NextResponse(null, { status: 204 });
  const payload = await response.json().catch(() => null);
  return NextResponse.json(payload, { status: response.status });
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ streamId: string }> },
) {
  return forward(request, (await params).streamId, "PATCH");
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ streamId: string }> },
) {
  return forward(request, (await params).streamId, "DELETE");
}
