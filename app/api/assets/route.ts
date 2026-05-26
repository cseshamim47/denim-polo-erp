import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequiredSession } from "@/lib/auth";
import { listAssetHistory } from "@/lib/services/asset-history";
import { createAsset, reviewAssets } from "@/lib/services/assets";

const createAssetSchema = z.object({
  title: z.string().trim().min(1),
  category: z.string().trim().min(1),
  amount: z.number().positive(),
  note: z.string().trim().optional(),
  assetDate: z.coerce.date(),
});

const reviewAssetSchema = z.union([
  z.object({
    assetId: z.string().trim().min(1),
    decision: z.enum(["approved", "rejected"]),
    comment: z.string().trim().optional(),
  }),
  z.object({
    assetIds: z.array(z.string().trim().min(1)).min(1),
    decision: z.enum(["approved", "rejected"]),
    comment: z.string().trim().optional(),
  }),
]);

export async function GET(request: Request) {
  const session = await getRequiredSession(["partner"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const history = await listAssetHistory({
      actorId: session.user.id,
      page: Number(searchParams.get("page") ?? "1"),
      pageSize: Number(searchParams.get("pageSize") ?? "10"),
      scope: searchParams.get("scope"),
      owner: searchParams.get("owner"),
      status: searchParams.get("status"),
      category: searchParams.get("category"),
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      needsReview: searchParams.get("needsReview") === "true",
    });

    return NextResponse.json(history);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load assets",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const session = await getRequiredSession(["partner"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createAssetSchema.safeParse(await request.json());

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];

    return NextResponse.json(
      { error: firstIssue?.message ?? "Invalid asset request." },
      { status: 400 },
    );
  }

  try {
    const asset = await createAsset({
      title: parsed.data.title,
      category: parsed.data.category,
      amount: parsed.data.amount,
      note: parsed.data.note,
      assetDate: parsed.data.assetDate,
      submittedBy: session.user.id,
      submittedByName:
        session.user.name ?? session.user.email ?? "Unknown partner",
    });

    return NextResponse.json({ assetId: asset._id.toString() }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to create asset",
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

  const parsed = reviewAssetSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const assetIds =
      "assetId" in parsed.data ? [parsed.data.assetId] : parsed.data.assetIds;
    const reviews = await reviewAssets({
      assetIds,
      partnerId: session.user.id,
      partnerName:
        session.user.name ?? session.user.email ?? "Unknown partner",
      decision: parsed.data.decision,
      comment: parsed.data.comment,
    });

    return NextResponse.json({ reviews });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to review asset",
      },
      { status: 400 },
    );
  }
}
