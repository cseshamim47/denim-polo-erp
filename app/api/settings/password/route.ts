import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getRequiredSession } from "@/lib/auth";
import { parsePasswordSettingsInput } from "@/lib/domain/settings";
import { updateUserPassword } from "@/lib/services/user-settings";

export async function PATCH(request: Request) {
  const session = await getRequiredSession(["partner", "salesman"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = parsePasswordSettingsInput(await request.json());

    await updateUserPassword({
      userId: session.user.id,
      currentPassword: payload.currentPassword,
      newPassword: payload.newPassword,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to update password",
      },
      { status: 400 },
    );
  }
}
