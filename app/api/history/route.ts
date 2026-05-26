import { NextResponse } from "next/server";

import { getRequiredSession } from "@/lib/auth";
import { listHistoryEvents } from "@/lib/services/history";

export async function GET(request: Request) {
  const session = await getRequiredSession(["partner"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  try {
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.max(
      1,
      Math.min(100, Number(searchParams.get("pageSize") ?? "20") || 20),
    );

    const history = await listHistoryEvents({
      actorId: session.user.id,
      module: searchParams.get("module"),
      action: searchParams.get("action"),
      actor: searchParams.get("actor"),
      search: searchParams.get("search"),
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      page,
      pageSize,
    });

    return NextResponse.json(history);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load history",
      },
      { status: 400 },
    );
  }
}
