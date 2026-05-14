import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  clearTestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from "../helpers/mongodb";

describe("asset integration", () => {
  beforeAll(async () => {
    await startTestDatabase();
  });

  afterEach(async () => {
    await clearTestDatabase();
    vi.resetModules();
    vi.restoreAllMocks();
    vi.doUnmock("@/lib/auth");
    vi.doUnmock("@/lib/services/asset-history");
  });

  afterAll(async () => {
    await stopTestDatabase();
  });

  it("requires approvals from all active non-submitter partners", async () => {
    const [
      { createAsset, reviewAsset },
      { default: AssetModel },
      { default: UserModel },
    ] = await Promise.all([
      import("../../lib/services/assets"),
      import("../../models/Asset"),
      import("../../models/User"),
    ]);

    const [partnerOne, partnerTwo, partnerThree] = await UserModel.create([
      {
        name: "Partner One",
        email: "partner1@example.com",
        role: "partner",
        authProvider: "credentials",
        isActive: true,
      },
      {
        name: "Partner Two",
        email: "partner2@example.com",
        role: "partner",
        authProvider: "credentials",
        isActive: true,
      },
      {
        name: "Partner Three",
        email: "partner3@example.com",
        role: "partner",
        authProvider: "credentials",
        isActive: true,
      },
    ]);

    const asset = await createAsset({
      title: "Office chair",
      category: "Furniture",
      amount: 4500,
      assetDate: new Date("2026-05-01T00:00:00.000Z"),
      submittedBy: partnerOne._id.toString(),
    });

    expect(asset.status).toBe("pending");
    expect(asset.requiredApprovalCountSnapshot).toBe(2);

    const afterFirstApproval = await reviewAsset({
      assetId: asset._id.toString(),
      partnerId: partnerTwo._id.toString(),
      decision: "approved",
    });

    expect(afterFirstApproval.status).toBe("pending");

    const afterSecondApproval = await reviewAsset({
      assetId: asset._id.toString(),
      partnerId: partnerThree._id.toString(),
      decision: "approved",
    });

    expect(afterSecondApproval.status).toBe("approved");

    const savedAsset = await AssetModel.findById(asset._id).lean();
    expect(savedAsset?.approvals).toHaveLength(2);
  });

  it("returns filtered paginated asset history with category suggestions", async () => {
    const [
      { listAssetHistory },
      { createAsset, reviewAsset },
      { default: UserModel },
    ] = await Promise.all([
      import("../../lib/services/asset-history"),
      import("../../lib/services/assets"),
      import("../../models/User"),
    ]);

    const [partnerOne, partnerTwo, partnerThree] = await UserModel.create([
      {
        name: "Partner One",
        email: "partner1@example.com",
        role: "partner",
        authProvider: "credentials",
        isActive: true,
      },
      {
        name: "Partner Two",
        email: "partner2@example.com",
        role: "partner",
        authProvider: "credentials",
        isActive: true,
      },
      {
        name: "Partner Three",
        email: "partner3@example.com",
        role: "partner",
        authProvider: "credentials",
        isActive: true,
      },
    ]);

    const approvedAsset = await createAsset({
      title: "Office desk",
      category: "Furniture",
      amount: 8000,
      assetDate: new Date("2026-05-03T00:00:00.000Z"),
      submittedBy: partnerOne._id.toString(),
    });

    await reviewAsset({
      assetId: approvedAsset._id.toString(),
      partnerId: partnerTwo._id.toString(),
      decision: "approved",
    });

    await reviewAsset({
      assetId: approvedAsset._id.toString(),
      partnerId: partnerThree._id.toString(),
      decision: "approved",
    });

    await createAsset({
      title: "Shop tablet",
      category: "Electronics",
      amount: 22000,
      assetDate: new Date("2026-05-04T00:00:00.000Z"),
      submittedBy: partnerThree._id.toString(),
    });

    const history = await listAssetHistory({
      actorId: partnerTwo._id.toString(),
      page: 1,
      pageSize: 10,
      scope: "others",
      owner: "",
      status: "approved",
      category: "Furniture",
      from: "2026-05-01",
      to: "2026-05-31",
    });

    expect(history.assets).toHaveLength(1);
    expect(history.assets[0]).toMatchObject({
      id: approvedAsset._id.toString(),
      title: "Office desk",
      category: "FURNITURE",
      status: "approved",
      submittedByName: "Partner One",
      canReview: false,
      approvalCount: 2,
      requiredApprovalCount: 2,
    });
    expect(history.pagination).toEqual({
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
    });
    expect(history.categorySuggestions).toEqual(["ELECTRONICS", "FURNITURE"]);
  });

  it("maps GET query params to asset history filters", async () => {
    const listAssetHistory = vi.fn().mockResolvedValue({
      partners: [],
      categorySuggestions: [],
      summary: {
        currentBalance: 0,
        approvedAssetTotal: 0,
        pendingAssetCount: 0,
      },
      assets: [],
      pagination: { page: 2, pageSize: 10, totalCount: 0, totalPages: 1 },
    });

    vi.doMock("@/lib/auth", () => ({
      getRequiredSession: vi.fn().mockResolvedValue({
        user: { id: "507f1f77bcf86cd799439011", role: "partner" },
      }),
    }));
    vi.doMock("@/lib/services/asset-history", () => ({
      listAssetHistory,
    }));

    const { GET } = await import("../../app/api/assets/route");
    const response = await GET(
      new Request(
        "http://localhost:3000/api/assets?page=2&pageSize=10&scope=others&owner=507f1f77bcf86cd799439012&status=approved&category=Furniture&from=2026-05-01&to=2026-05-31",
      ),
    );

    expect(response.status).toBe(200);
    expect(listAssetHistory).toHaveBeenCalledWith({
      actorId: "507f1f77bcf86cd799439011",
      page: 2,
      pageSize: 10,
      scope: "others",
      owner: "507f1f77bcf86cd799439012",
      status: "approved",
      category: "Furniture",
      from: "2026-05-01",
      to: "2026-05-31",
    });
  });
});
