import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.doUnmock("@/lib/auth");
  vi.doUnmock("@/lib/services/history");
});

describe("history route", () => {
  it("loads partner-only history with filters", async () => {
    vi.doMock("@/lib/auth", () => ({
      getRequiredSession: vi.fn().mockResolvedValue({
        user: { id: "partner-1", name: "Partner One", role: "partner" },
      }),
    }));

    const listHistoryEvents = vi.fn().mockResolvedValue({
      items: [],
      pagination: { total: 0, page: 1, pageSize: 20, totalPages: 1 },
      actors: [],
    });

    vi.doMock("@/lib/services/history", () => ({
      listHistoryEvents,
    }));

    const { GET } = await import("../../app/api/history/route");
    const response = await GET(
      new Request(
        "http://localhost:3000/api/history?module=products&action=create",
      ),
    );

    expect(response.status).toBe(200);
    expect(listHistoryEvents).toHaveBeenCalledWith({
      actorId: "partner-1",
      module: "products",
      action: "create",
      actor: null,
      search: null,
      from: null,
      to: null,
      page: 1,
      pageSize: 20,
    });
  });
});
