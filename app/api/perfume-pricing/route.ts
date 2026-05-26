import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequiredSession } from "@/lib/auth";
import { pickChangedFields } from "@/lib/domain/history";
import { recordHistoryEvent } from "@/lib/services/history";
import {
  createPerfumePricingRule,
  listPerfumePricingRules,
  updatePerfumePricingRule,
} from "@/lib/services/perfume-pricing";

const createRuleSchema = z.object({
  perfumeVariantId: z.string().trim().min(1),
  bottleVariantId: z.string().trim().min(1),
  fillMl: z.number().int().positive(),
  bottleSellingPrice: z.number().nonnegative(),
});

const updateRuleSchema = z.object({
  ruleId: z.string().trim().min(1),
  fillMl: z.number().int().positive().optional(),
  bottleSellingPrice: z.number().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: Request) {
  const session = await getRequiredSession(["partner", "salesman"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  try {
    const data = await listPerfumePricingRules({
      perfumeVariantId: searchParams.get("perfumeVariantId"),
      bottleVariantId: searchParams.get("bottleVariantId"),
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load perfume pricing",
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

  const parsed = createRuleSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const rule = await createPerfumePricingRule(parsed.data);

    await recordHistoryEvent({
      actorId: session.user.id,
      actorName: session.user.name ?? session.user.email ?? "Unknown partner",
      actorRole: "partner",
      module: "perfume_pricing",
      entityType: "perfume_pricing_rule",
      entityId: rule.id,
      entityLabel: parsed.data.perfumeVariantId,
      action: "create",
      summary: "Perfume pricing rule created",
      before: null,
      after: {
        perfumeVariantId: parsed.data.perfumeVariantId,
        bottleVariantId: parsed.data.bottleVariantId,
        fillMl: parsed.data.fillMl,
        bottleSellingPrice: parsed.data.bottleSellingPrice,
        isActive: true,
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to create perfume pricing rule",
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

  const parsed = updateRuleSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const beforeSnapshot = {
      fillMl: parsed.data.fillMl,
      bottleSellingPrice: parsed.data.bottleSellingPrice,
      isActive: parsed.data.isActive,
    };
    const rule = await updatePerfumePricingRule(parsed.data);

    await recordHistoryEvent({
      actorId: session.user.id,
      actorName: session.user.name ?? session.user.email ?? "Unknown partner",
      actorRole: "partner",
      module: "perfume_pricing",
      entityType: "perfume_pricing_rule",
      entityId: rule.id,
      entityLabel: parsed.data.ruleId,
      action: "update",
      summary: "Perfume pricing rule updated",
      ...pickChangedFields(null, beforeSnapshot),
    });

    return NextResponse.json(rule);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to update perfume pricing rule",
      },
      { status: 400 },
    );
  }
}
