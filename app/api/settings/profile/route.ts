import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getRequiredSession } from "@/lib/auth";
import { parseProfileSettingsInput } from "@/lib/domain/settings";
import { updateUserName } from "@/lib/services/user-settings";

export async function PATCH(request: Request) {
  const session = await getRequiredSession(["partner", "salesman"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = parseProfileSettingsInput(await request.json());
    const user = await updateUserName({
      userId: session.user.id,
      name: payload.name,
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

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
