import { NextResponse } from "next/server";

import { getRequiredSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/server/dashboard";

export async function GET() {
  const session = await getRequiredSession(["partner"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await getDashboardData());
}
