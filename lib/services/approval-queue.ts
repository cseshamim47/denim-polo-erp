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
};

type ApprovalQueueSort = "newest" | "oldest";

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
  };
}

export async function listApprovalQueue(input: {
  actorId: string;
  kind?: string | null;
  owner?: string | null;
  search?: string | null;
  sort?: string | null;
}) {
  const selectedKind = input.kind?.trim() as ApprovalQueueKind | undefined;
  const selectedOwner = input.owner?.trim();
  const search = input.search?.trim() ?? "";
  const sort: ApprovalQueueSort = input.sort === "oldest" ? "oldest" : "newest";

  const [purchases, expenses, investments, assets] = await Promise.all([
    listPurchases({
      actorId: input.actorId,
      page: 1,
      pageSize: 100,
      needsReview: true,
    }),
    listExpenseHistory({
      actorId: input.actorId,
      page: 1,
      pageSize: 100,
      needsReview: true,
    }),
    listInvestmentHistory({
      actorId: input.actorId,
      page: 1,
      pageSize: 100,
      needsReview: true,
    }),
    listAssetHistory({
      actorId: input.actorId,
      page: 1,
      pageSize: 100,
      needsReview: true,
    }),
  ]);

  const partners = new Map<string, { id: string; name: string; email: string }>();

  for (const group of [
    expenses.partners,
    investments.partners,
    assets.partners,
  ]) {
    for (const partner of group) {
      partners.set(partner.id, partner);
    }
  }

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
  }));

  const allItems = [
    ...purchaseItems,
    ...expenseItems,
    ...investmentItems,
    ...assetItems,
  ];

  const items = allItems
    .filter((item) => (selectedKind ? item.kind === selectedKind : true))
    .filter((item) => (selectedOwner ? item.ownerId === selectedOwner : true))
    .filter((item) => matchesSearch(item, search))
    .sort((left, right) => {
      const delta =
        new Date(left.submittedAt).getTime() - new Date(right.submittedAt).getTime();

      return sort === "oldest" ? delta : -delta;
    });

  return {
    summary: {
      total: allItems.length,
      purchases: purchaseItems.length,
      expenses: expenseItems.length,
      investments: investmentItems.length,
      assets: assetItems.length,
    },
    partners: Array.from(partners.values()).sort((left, right) =>
      left.name.localeCompare(right.name),
    ),
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
