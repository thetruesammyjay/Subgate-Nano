import { NextResponse } from "next/server";
import {
  createContentInputSchema,
  type CreateContentInput,
} from "@subgate/types";
import { getDashboardSession } from "../../../../lib/dashboard-auth";
import { createDashboardContent } from "../../../../lib/subgate-api";

export const POST = async (request: Request) => {
  const session = await getDashboardSession();

  if (!session.isAuthenticated) {
    return NextResponse.json(
      {
        message: "Dashboard session is required.",
      },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createContentInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Invalid content payload.",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  try {
    const content = await createDashboardContent(parsed.data as CreateContentInput);

    return NextResponse.json(content, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to create content.",
      },
      { status: 502 },
    );
  }
};
