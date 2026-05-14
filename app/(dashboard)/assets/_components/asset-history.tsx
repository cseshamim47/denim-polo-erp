"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  currency,
  getAssetStatusClassName,
  type AssetFiltersState,
  type AssetsResponse,
} from "../asset-types";

export function AssetHistory({
  data,
  isLoading,
  filters,
  onChangeFilters,
  onReview,
  onOpenNote,
}: {
  data: AssetsResponse | null;
  isLoading: boolean;
  filters: AssetFiltersState;
  onChangeFilters: (next: AssetFiltersState) => void;
  onReview: (assetId: string, decision: "approved" | "rejected") => Promise<void>;
  onOpenNote: (note: { title: string; note: string }) => void;
}) {
  return (
    <section className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <h3 className="text-xl font-semibold tracking-tight">Asset history</h3>
        <p className="text-sm text-(--text-secondary)">
          {isLoading
            ? "Loading..."
            : `${data?.pagination.totalCount ?? 0} record(s)`}
        </p>
      </div>

      <div className="mt-4 grid gap-4 md:hidden">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <Card
              key={`asset-loading-mobile-${index}`}
              className="gap-0 rounded-[1.2rem] border-(--stroke-soft) bg-white/90 py-0 shadow-none"
            >
              <CardContent className="px-4 py-5">
                <Spinner className="min-h-20" label="Loading assets..." />
              </CardContent>
            </Card>
          ))
        ) : (data?.assets ?? []).length > 0 ? (
          (data?.assets ?? []).map((asset) => (
            <Card
              key={asset.id}
              className="gap-4 rounded-[1.2rem] border-(--stroke-soft) bg-white/90 py-4 shadow-none"
            >
              <CardHeader className="px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{asset.title}</CardTitle>
                    <CardDescription>
                      {asset.category} · {asset.submittedByName}
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={getAssetStatusClassName(asset.status)}
                  >
                    {asset.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 px-4">
                <div className="grid grid-cols-2 gap-3 rounded-xl bg-(--surface-accent-soft) p-3 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-(--text-secondary)">
                      Amount
                    </p>
                    <p className="mt-1 font-semibold text-foreground">
                      {currency(asset.amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-(--text-secondary)">
                      Asset date
                    </p>
                    <p className="mt-1 font-medium text-foreground">
                      {new Date(asset.assetDate).toLocaleDateString("en-BD")}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-(--text-secondary)">
                    Approval progress
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {asset.approvalCount}/{asset.requiredApprovalCount}
                  </p>
                  <div className="grid gap-1.5 text-xs text-(--text-secondary)">
                    {asset.approvals.length > 0 ? (
                      asset.approvals.map((approval) => (
                        <span key={`${asset.id}-${approval.partnerId}`}>
                          {approval.partnerName} {approval.decision}
                        </span>
                      ))
                    ) : (
                      <span>No review yet</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-(--stroke-soft) px-3 py-2.5">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-(--text-secondary)">
                      Note
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      {asset.note?.trim() ? "Available" : "No note"}
                    </p>
                  </div>
                  {asset.note?.trim() ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onOpenNote({
                          title: asset.title,
                          note: asset.note ?? "",
                        })
                      }
                    >
                      View note
                    </Button>
                  ) : null}
                </div>
              </CardContent>
              <CardFooter className="px-4">
                {asset.canReview ? (
                  <div className="grid w-full grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => void onReview(asset.id, "approved")}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => void onReview(asset.id, "rejected")}
                    >
                      Reject
                    </Button>
                  </div>
                ) : (
                  <div className="w-full rounded-xl bg-(--surface-accent-soft) px-3 py-2 text-center text-xs text-(--text-secondary)">
                    No action
                  </div>
                )}
              </CardFooter>
            </Card>
          ))
        ) : (
          <Card className="gap-0 rounded-[1.2rem] border-(--stroke-soft) bg-white/90 py-0 shadow-none">
            <CardContent className="px-4 py-5 text-sm text-(--text-secondary)">
              No assets found for the selected filters.
            </CardContent>
          </Card>
        )}
      </div>

      <div className="mt-4 hidden overflow-x-auto rounded-[1.2rem] ring-1 ring-(--stroke-soft) md:block">
        <table className="w-full min-w-240 text-sm">
          <thead className="bg-(--surface-accent-soft)">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Title</th>
              <th className="px-3 py-2 text-left font-semibold">Category</th>
              <th className="px-3 py-2 text-left font-semibold">Owner</th>
              <th className="px-3 py-2 text-left font-semibold">Asset Date</th>
              <th className="px-3 py-2 text-right font-semibold">Amount</th>
              <th className="px-3 py-2 text-left font-semibold">Status</th>
              <th className="px-3 py-2 text-left font-semibold">Approvals</th>
              <th className="px-3 py-2 text-center font-semibold">Note</th>
              <th className="px-3 py-2 text-center font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-(--stroke-soft) bg-white/70">
            {isLoading ? (
              <tr>
                <td className="px-3 py-8" colSpan={9}>
                  <Spinner label="Loading asset history..." />
                </td>
              </tr>
            ) : (
              (data?.assets ?? []).map((asset) => (
                <tr key={asset.id} className="align-top">
                  <td className="px-3 py-3 font-medium text-foreground">
                    {asset.title}
                  </td>
                  <td className="px-3 py-3 text-(--text-secondary)">
                    {asset.category}
                  </td>
                  <td className="px-3 py-3 text-(--text-secondary)">
                    {asset.submittedByName}
                  </td>
                  <td className="px-3 py-3 text-(--text-secondary)">
                    {new Date(asset.assetDate).toLocaleDateString("en-BD")}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-foreground">
                    {currency(asset.amount)}
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex rounded-full bg-(--surface-accent-soft) px-2.5 py-1 text-xs font-semibold uppercase tracking-widest text-(--text-secondary)">
                      {asset.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-(--text-secondary)">
                    <div className="grid gap-1">
                      <span className="text-xs font-medium">
                        {asset.approvalCount}/{asset.requiredApprovalCount}
                      </span>
                      {asset.approvals.length > 0 ? (
                        asset.approvals.map((approval) => (
                          <span
                            key={`${asset.id}-${approval.partnerId}`}
                            className="text-xs leading-5"
                          >
                            {approval.partnerName} {approval.decision}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs">No review yet</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {asset.note?.trim() ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onOpenNote({
                            title: asset.title,
                            note: asset.note ?? "",
                          })
                        }
                      >
                        View Note
                      </Button>
                    ) : (
                      <span className="text-xs text-(--text-secondary)">
                        No note
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {asset.canReview ? (
                      <div className="flex justify-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => void onReview(asset.id, "approved")}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => void onReview(asset.id, "rejected")}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center text-xs text-(--text-secondary)">
                        No action
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          className="btn-secondary"
          disabled={(data?.pagination.page ?? 1) <= 1}
          onClick={() =>
            onChangeFilters({ ...filters, page: Math.max(filters.page - 1, 1) })
          }
          type="button"
        >
          Previous
        </button>
        <p className="text-sm text-(--text-secondary)">
          Page {data?.pagination.page ?? 1} / {data?.pagination.totalPages ?? 1}
        </p>
        <button
          className="btn-secondary"
          disabled={
            (data?.pagination.page ?? 1) >= (data?.pagination.totalPages ?? 1)
          }
          onClick={() =>
            onChangeFilters({
              ...filters,
              page: Math.min(
                filters.page + 1,
                data?.pagination.totalPages ?? filters.page + 1,
              ),
            })
          }
          type="button"
        >
          Next
        </button>
      </div>
    </section>
  );
}
