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

export type ApprovalsResponse = {
  view: "mine" | "partners";
  summary: {
    total: number;
    purchases: number;
    expenses: number;
    investments: number;
    assets: number;
  };
  partners: Array<{
    id: string;
    name: string;
    email: string;
  }>;
  partnerPendingCounts: Array<{
    partnerId: string;
    partnerName: string;
    pendingCount: number;
  }>;
  items: ApprovalQueueItem[];
};

export type ApprovalFiltersState = {
  view: "mine" | "partners";
  pendingPartner: string;
  kind: "" | ApprovalQueueKind;
  owner: string;
  search: string;
  sort: "newest" | "oldest";
};

export const approvalKindOptions = [
  { value: "", label: "All modules" },
  { value: "purchases", label: "Purchases" },
  { value: "expenses", label: "Expenses" },
  { value: "investments", label: "Investments" },
  { value: "assets", label: "Assets" },
] as const;

export const approvalSortOptions = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
] as const;

export function currency(value: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  }).format(value);
}

export async function readJsonResponse<T>(response: Response) {
  const body = await response.text();

  if (!body) {
    return null as T | null;
  }

  return JSON.parse(body) as T;
}
