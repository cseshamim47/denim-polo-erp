export type HistoryItem = {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  module: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  action: string;
  summary: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
};

export type HistoryActorOption = {
  id: string;
  name: string;
  role: string;
};

export type HistoryResponse = {
  items: HistoryItem[];
  actors: HistoryActorOption[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
};

export type HistoryFiltersState = {
  search: string;
  module: string;
  action: string;
  actor: string;
  from: string;
  to: string;
};

export const moduleOptions = [
  { value: "", label: "All modules" },
  { value: "products", label: "Products" },
  { value: "variants", label: "Variants" },
  { value: "purchases", label: "Purchases" },
  { value: "expenses", label: "Expenses" },
  { value: "investments", label: "Investments" },
  { value: "assets", label: "Assets" },
  { value: "sales", label: "Sales" },
  { value: "returns", label: "Returns" },
  { value: "perfume_pricing", label: "Perfume pricing" },
  { value: "settings", label: "Settings" },
  { value: "approvals", label: "Approvals" },
] as const;

export async function readJsonResponse<T>(response: Response) {
  const body = await response.text();

  if (!body) {
    return null as T | null;
  }

  return JSON.parse(body) as T;
}
