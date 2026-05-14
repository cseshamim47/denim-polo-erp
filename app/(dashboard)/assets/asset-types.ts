export type AssetRecord = {
  id: string;
  title: string;
  category: string;
  amount: number;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  submittedById: string;
  submittedByName: string;
  submittedAt: string;
  assetDate: string;
  requiredApprovalCount: number;
  approvalCount: number;
  canReview: boolean;
  approvals: Array<{
    partnerId: string;
    partnerName: string;
    decision: "approved" | "rejected";
    comment: string | null;
    decidedAt: string;
  }>;
};

export type AssetsResponse = {
  partners: Array<{
    id: string;
    name: string;
    email: string;
  }>;
  categorySuggestions: string[];
  summary: {
    currentBalance: number;
    approvedAssetTotal: number;
    pendingAssetCount: number;
  };
  assets: AssetRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
};

export type AssetFormState = {
  title: string;
  category: string;
  amount: string;
  assetDate: string;
  note: string;
};

export type AssetFiltersState = {
  page: number;
  scope: "all" | "mine" | "others";
  owner: string;
  status: "" | "pending" | "approved" | "rejected";
  category: string;
  from: string;
  to: string;
};

export const assetScopeOptions = [
  { value: "all", label: "All assets" },
  { value: "mine", label: "My requests" },
  { value: "others", label: "Other partners" },
] as const;

export const assetStatusOptions = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
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

export function getAssetStatusClassName(status: AssetRecord["status"]) {
  if (status === "approved") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "rejected") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-800";
}
