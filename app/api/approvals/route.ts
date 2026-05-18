import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequiredSession } from "@/lib/auth";
import {
  listApprovalQueue,
  reviewApprovalQueueItems,
} from "@/lib/services/approval-queue";

const reviewQueueSchema = z.object({
  items: z
    .array(
      z.object({
        kind: z.enum(["purchases", "expenses", "investments", "assets"]),
        id: z.string().trim().min(1),
      }),
    )
    .min(1),
  decision: z.enum(["approved", "rejected"]),
  comment: z.string().trim().optional(),
});

export async function GET(request: Request) {
  const session = await getRequiredSession(["partner"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const queue = await listApprovalQueue({
      actorId: session.user.id,
      kind: searchParams.get("kind"),
      owner: searchParams.get("owner"),
      search: searchParams.get("search"),
      sort: searchParams.get("sort"),
    });

    return NextResponse.json(queue);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load approvals",
      },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getRequiredSession(["partner"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = reviewQueueSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const reviews = await reviewApprovalQueueItems({
      items: parsed.data.items,
      partnerId: session.user.id,
      partnerName: session.user.name ?? session.user.email ?? "Unknown partner",
      decision: parsed.data.decision,
      comment: parsed.data.comment,
    });

    return NextResponse.json({ reviews });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to review approvals",
      },
      { status: 400 },
    );
  }
}
