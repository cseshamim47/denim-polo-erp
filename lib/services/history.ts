import { connectToDatabase } from "@/lib/db";
import HistoryEventModel from "@/models/HistoryEvent";

type HistoryEventRecord = {
  actorId: string;
  actorName: string;
  actorRole: string;
  module: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  action: string;
  summary: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
};

export async function recordHistoryEvent(input: HistoryEventRecord) {
  await connectToDatabase();

  await HistoryEventModel.create({
    ...input,
    before: input.before ?? null,
    after: input.after ?? null,
    meta: input.meta ?? null,
  });
}

export async function listHistoryEvents(input: {
  actorId: string;
  module: string | null;
  action: string | null;
  actor: string | null;
  search: string | null;
  from: string | null;
  to: string | null;
  page: number;
  pageSize: number;
}) {
  await connectToDatabase();

  const query: Record<string, unknown> = {};

  if (input.module) {
    query.module = input.module;
  }

  if (input.action) {
    query.action = input.action;
  }

  if (input.actor) {
    query.actorId = input.actor;
  }

  if (input.search?.trim()) {
    query.$or = [
      { summary: { $regex: input.search.trim(), $options: "i" } },
      { entityLabel: { $regex: input.search.trim(), $options: "i" } },
      { actorName: { $regex: input.search.trim(), $options: "i" } },
    ];
  }

  if (input.from || input.to) {
    const createdAtQuery: { $gte?: Date; $lte?: Date } = {};

    if (input.from) {
      createdAtQuery.$gte = new Date(`${input.from}T00:00:00.000Z`);
    }

    if (input.to) {
      createdAtQuery.$lte = new Date(`${input.to}T23:59:59.999Z`);
    }

    query.createdAt = createdAtQuery;
  }

  const total = await HistoryEventModel.countDocuments(query);
  const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
  const page = Math.min(Math.max(1, input.page), totalPages);
  const skip = (page - 1) * input.pageSize;

  const [events, actorRows] = await Promise.all([
    HistoryEventModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(input.pageSize)
      .lean(),
    HistoryEventModel.aggregate<{
      _id: string;
      actorName: string;
      actorRole: string;
    }>([
      {
        $group: {
          _id: "$actorId",
          actorName: { $first: "$actorName" },
          actorRole: { $first: "$actorRole" },
        },
      },
      { $sort: { actorName: 1 } },
    ]),
  ]);

  return {
    items: events.map((event) => ({
      id: event._id.toString(),
      actorId: event.actorId,
      actorName: event.actorName,
      actorRole: event.actorRole,
      module: event.module,
      entityType: event.entityType,
      entityId: event.entityId,
      entityLabel: event.entityLabel,
      action: event.action,
      summary: event.summary,
      before: (event.before as Record<string, unknown> | null) ?? null,
      after: (event.after as Record<string, unknown> | null) ?? null,
      meta: (event.meta as Record<string, unknown> | null) ?? null,
      createdAt: event.createdAt.toISOString(),
    })),
    actors: actorRows.map((actor) => ({
      id: actor._id,
      name: actor.actorName,
      role: actor.actorRole,
    })),
    pagination: {
      total,
      page,
      pageSize: input.pageSize,
      totalPages,
    },
  };
}
