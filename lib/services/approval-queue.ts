import UserModel from "@/models/User";
import { listAssetHistory } from "@/lib/services/asset-history";
import { listExpenseHistory } from "@/lib/services/expense-history";
import { listInvestmentHistory } from "@/lib/services/investment-history";
import { reviewAssets } from "@/lib/services/assets";
import { reviewExpenses } from "@/lib/services/expenses";
import { reviewInvestments } from "@/lib/services/investments";
import {
  listPurchases,
  reviewPurchases,
  type PurchaseHistoryRecord,
} from "@/lib/services/purchases";
import {
  type ApprovalDecision,
  type ApprovalReviewUpdate,
} from "@/lib/services/approval-review";

export type ApprovalQueueKind =
  | "purchases"
  | "expenses"
  | "investments"
  | "assets";

export type ApprovalQueueItem = {
  id: string;
  selectionKey: string;
  kind: ApprovalQueueKind;
  title: string;
  subtitle: string;
  ownerId: string;
  ownerName: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  effectiveDate: string;
  note: string | null;
  approvalCount: number;
  requiredApprovalCount: number;
  canReview: boolean;
  pendingPartnerIds: string[];
  pendingPartnerNames: string[];
};

type ApprovalQueueSort = "newest" | "oldest";
type ApprovalQueueView = "mine" | "partners";

function matchesSearch(item: ApprovalQueueItem, search: string) {
  const normalized = search.trim().toLocaleLowerCase();

  if (!normalized) {
    return true;
  }

  return (
    item.title.toLocaleLowerCase().includes(normalized) ||
    item.subtitle.toLocaleLowerCase().includes(normalized) ||
    item.ownerName.toLocaleLowerCase().includes(normalized) ||
    (item.note ?? "").toLocaleLowerCase().includes(normalized)
  );
}

function mapPurchaseItem(record: PurchaseHistoryRecord): ApprovalQueueItem {
  return {
    id: record.id,
    selectionKey: `purchases:${record.id}`,
    kind: "purchases",
    title: record.productName,
    subtitle: `${record.sku} · ${record.size} · ${record.color}`,
    ownerId: record.createdById,
    ownerName: record.createdByName,
    amount: record.cashOutTotal,
    status: record.status,
    submittedAt: record.purchaseDate,
    effectiveDate: record.purchaseDate,
    note: record.note,
    approvalCount: record.approvalCount,
    requiredApprovalCount: record.requiredApprovalCount,
    canReview: record.canReview,
    pendingPartnerIds: record.pendingPartnerIds,
    pendingPartnerNames: record.pendingPartnerNames,
  };
}

export async function listApprovalQueue(input: {
  actorId: string;
  view?: string | null;
  pendingPartner?: string | null;
  kind?: string | null;
  owner?: string | null;
  search?: string | null;
  sort?: string | null;
}) {
  const view: ApprovalQueueView = input.view === "partners" ? "partners" : "mine";
  const pendingPartner = input.pendingPartner?.trim();
  const selectedKind = input.kind?.trim() as ApprovalQueueKind | undefined;
  const selectedOwner = input.owner?.trim();
  const search = input.search?.trim() ?? "";
  const sort: ApprovalQueueSort = input.sort === "oldest" ? "oldest" : "newest";

  const [allPartners, purchases, expenses, investments, assets] = await Promise.all([
    UserModel.find({ role: "partner", isActive: true }).sort({ name: 1 }).lean(),
    listPurchases({
      actorId: input.actorId,
      page: 1,
      pageSize: 100,
      needsReview: view === "mine",
      status: view === "partners" ? "pending" : null,
    }),
    listExpenseHistory({
      actorId: input.actorId,
      page: 1,
      pageSize: 100,
      needsReview: view === "mine",
      status: view === "partners" ? "pending" : null,
    }),
    listInvestmentHistory({
      actorId: input.actorId,
      page: 1,
      pageSize: 100,
      needsReview: view === "mine",
      status: view === "partners" ? "pending" : null,
    }),
    listAssetHistory({
      actorId: input.actorId,
      page: 1,
      pageSize: 100,
      needsReview: view === "mine",
      status: view === "partners" ? "pending" : null,
    }),
  ]);

  const partners = new Map(
    allPartners.map((partner) => [
      partner._id.toString(),
      {
        id: partner._id.toString(),
        name: partner.name,
        email: partner.email,
      },
    ]),
  );

  const purchaseItems = purchases.items.map(mapPurchaseItem);
  const expenseItems = expenses.expenses.map((expense) => ({
    id: expense.id,
    selectionKey: `expenses:${expense.id}`,
    kind: "expenses" as const,
    title: expense.title,
    subtitle: "Expense request",
    ownerId: expense.submittedById,
    ownerName: expense.submittedByName,
    amount: expense.amount,
    status: expense.status,
    submittedAt: expense.submittedAt,
    effectiveDate: expense.expenseDate,
    note: expense.note,
    approvalCount: expense.approvalCount,
    requiredApprovalCount: expense.requiredApprovalCount,
    canReview: expense.canReview,
    pendingPartnerIds: expense.pendingPartnerIds,
    pendingPartnerNames: expense.pendingPartnerNames,
  }));
  const investmentItems = investments.investments.map((investment) => ({
    id: investment.id,
    selectionKey: `investments:${investment.id}`,
    kind: "investments" as const,
    title: "Partner investment",
    subtitle: investment.partnerName,
    ownerId: investment.partnerId,
    ownerName: investment.partnerName,
    amount: investment.amount,
    status: investment.status,
    submittedAt: investment.submittedAt,
    effectiveDate: investment.investedAt,
    note: investment.note,
    approvalCount: investment.approvalCount,
    requiredApprovalCount: investment.requiredApprovalCount,
    canReview: investment.canReview,
    pendingPartnerIds: investment.pendingPartnerIds,
    pendingPartnerNames: investment.pendingPartnerNames,
  }));
  const assetItems = assets.assets.map((asset) => ({
    id: asset.id,
    selectionKey: `assets:${asset.id}`,
    kind: "assets" as const,
    title: asset.title,
    subtitle: asset.category,
    ownerId: asset.submittedById,
    ownerName: asset.submittedByName,
    amount: asset.amount,
    status: asset.status,
    submittedAt: asset.submittedAt,
    effectiveDate: asset.assetDate,
    note: asset.note,
    approvalCount: asset.approvalCount,
    requiredApprovalCount: asset.requiredApprovalCount,
    canReview: asset.canReview,
    pendingPartnerIds: asset.pendingPartnerIds,
    pendingPartnerNames: asset.pendingPartnerNames,
  }));

  const allItems = [
    ...purchaseItems,
    ...expenseItems,
    ...investmentItems,
    ...assetItems,
  ];
  const actorFilteredItems =
    view === "mine"
      ? allItems
      : allItems
          .map((item) => {
            const pendingPartners = item.pendingPartnerIds
              .map((partnerId, index) => ({
                partnerId,
                partnerName: item.pendingPartnerNames[index] ?? "Unknown partner",
              }))
              .filter((partner) => partner.partnerId !== input.actorId);

            return {
              ...item,
              pendingPartnerIds: pendingPartners.map((partner) => partner.partnerId),
              pendingPartnerNames: pendingPartners.map((partner) => partner.partnerName),
            };
          })
          .filter((item) => item.pendingPartnerIds.length > 0);
  const filteredByPendingPartner =
    view === "partners" && pendingPartner
      ? actorFilteredItems.filter((item) =>
          item.pendingPartnerIds.includes(pendingPartner),
        )
      : actorFilteredItems;

  const items = filteredByPendingPartner
    .filter((item) => (selectedKind ? item.kind === selectedKind : true))
    .filter((item) => (selectedOwner ? item.ownerId === selectedOwner : true))
    .filter((item) => matchesSearch(item, search))
    .sort((left, right) => {
      const delta =
        new Date(left.submittedAt).getTime() - new Date(right.submittedAt).getTime();

      return sort === "oldest" ? delta : -delta;
    });
  const partnerPendingCounts = Array.from(
    actorFilteredItems.reduce((map, item) => {
      for (const [index, partnerId] of item.pendingPartnerIds.entries()) {
        if (partnerId === input.actorId) {
          continue;
        }

        const current = map.get(partnerId) ?? {
          partnerId,
          partnerName: item.pendingPartnerNames[index] ?? "Unknown partner",
          pendingCount: 0,
        };

        current.pendingCount += 1;
        map.set(partnerId, current);
      }

      return map;
    }, new Map<string, { partnerId: string; partnerName: string; pendingCount: number }>()),
  )
    .map((entry) => entry[1])
    .sort((left, right) =>
      right.pendingCount - left.pendingCount || left.partnerName.localeCompare(right.partnerName),
    );

  return {
    view,
    summary: {
      total: actorFilteredItems.length,
      purchases: actorFilteredItems.filter((item) => item.kind === "purchases").length,
      expenses: actorFilteredItems.filter((item) => item.kind === "expenses").length,
      investments: actorFilteredItems.filter((item) => item.kind === "investments").length,
      assets: actorFilteredItems.filter((item) => item.kind === "assets").length,
    },
    partners: Array.from(partners.values()).sort((left, right) =>
      left.name.localeCompare(right.name),
    ),
    partnerPendingCounts,
    items,
  };
}

export async function reviewApprovalQueueItems(input: {
  items: Array<{ kind: ApprovalQueueKind; id: string }>;
  partnerId: string;
  partnerName: string;
  decision: ApprovalDecision;
  comment?: string;
}) {
  const purchaseIds = input.items
    .filter((item) => item.kind === "purchases")
    .map((item) => item.id);
  const expenseIds = input.items
    .filter((item) => item.kind === "expenses")
    .map((item) => item.id);
  const investmentIds = input.items
    .filter((item) => item.kind === "investments")
    .map((item) => item.id);
  const assetIds = input.items
    .filter((item) => item.kind === "assets")
    .map((item) => item.id);

  const results = await Promise.all([
    purchaseIds.length > 0
      ? reviewPurchases({
          purchaseIds,
          partnerId: input.partnerId,
          partnerName: input.partnerName,
          decision: input.decision,
          comment: input.comment,
        })
      : Promise.resolve([]),
    expenseIds.length > 0
      ? reviewExpenses({
          expenseIds,
          partnerId: input.partnerId,
          partnerName: input.partnerName,
          decision: input.decision,
          comment: input.comment,
        })
      : Promise.resolve([]),
    investmentIds.length > 0
      ? reviewInvestments({
          investmentIds,
          partnerId: input.partnerId,
          partnerName: input.partnerName,
          decision: input.decision,
          comment: input.comment,
        })
      : Promise.resolve([]),
    assetIds.length > 0
      ? reviewAssets({
          assetIds,
          partnerId: input.partnerId,
          partnerName: input.partnerName,
          decision: input.decision,
          comment: input.comment,
        })
      : Promise.resolve([]),
  ]);

  const [purchaseReviews, expenseReviews, investmentReviews, assetReviews] =
    results;

  return [
    ...purchaseReviews.map((review) => ({ ...review, kind: "purchases" as const })),
    ...expenseReviews.map((review) => ({ ...review, kind: "expenses" as const })),
    ...investmentReviews.map((review) => ({
      ...review,
      kind: "investments" as const,
    })),
    ...assetReviews.map((review) => ({ ...review, kind: "assets" as const })),
  ] satisfies Array<ApprovalReviewUpdate & { kind: ApprovalQueueKind }>;
}
