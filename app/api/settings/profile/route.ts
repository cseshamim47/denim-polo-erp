import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getRequiredSession } from "@/lib/auth";
import { parseProfileSettingsInput } from "@/lib/domain/settings";
import { pickChangedFields } from "@/lib/domain/history";
import { recordHistoryEvent } from "@/lib/services/history";
import { updateUserName } from "@/lib/services/user-settings";

export async function PATCH(request: Request) {
  const session = await getRequiredSession(["partner", "salesman"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = parseProfileSettingsInput(await request.json());
    const previousName = session.user.name ?? "Unknown user";
    const user = await updateUserName({
      userId: session.user.id,
      name: payload.name,
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const snapshot = pickChangedFields(
      { name: previousName },
      { name: user.name },
    );

    await recordHistoryEvent({
      actorId: session.user.id,
      actorName: previousName,
      actorRole: session.user.role ?? "unknown",
      module: "settings",
      entityType: "user",
      entityId: user._id.toString(),
      entityLabel: user.email,
      action: "update_profile",
      summary: "Profile updated",
      before: snapshot.before,
      after: snapshot.after,
    });

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update profile",
      },
      { status: 400 },
    );
  }
}
