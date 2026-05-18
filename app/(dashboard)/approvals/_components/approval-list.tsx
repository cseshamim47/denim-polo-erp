"use client";

import { ApprovalSelectionBar } from "@/components/approval/approval-selection-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  type ApprovalQueueItem,
  type ApprovalsResponse,
} from "../approval-types";

function statusClassName(status: ApprovalQueueItem["status"]) {
  if (status === "approved") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "rejected") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-800";
}

export function ApprovalList({
  data,
  isLoading,
  selectedIds,
  onToggleSelected,
  onToggleAllVisible,
  onApproveSelected,
  onReviewOne,
  isReviewSubmitting,
}: {
  data: ApprovalsResponse | null;
  isLoading: boolean;
  selectedIds: string[];
  onToggleSelected: (selectionKey: string, checked: boolean) => void;
  onToggleAllVisible: () => void;
  onApproveSelected: () => Promise<void>;
  onReviewOne: (
    item: ApprovalQueueItem,
    decision: "approved" | "rejected",
  ) => Promise<void>;
  isReviewSubmitting: boolean;
}) {
  const items = data?.items ?? [];
  const allVisibleSelected =
    items.length > 0 && items.every((item) => selectedIds.includes(item.selectionKey));

  return (
    <section className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-xl font-semibold tracking-tight">Pending approvals</h3>
          <p className="mt-1 text-sm text-(--text-secondary)">
            {isLoading ? "Loading..." : `${items.length} visible item(s)`}
          </p>
        </div>
      </div>

      <ApprovalSelectionBar
        selectedCount={selectedIds.length}
        selectableCount={items.length}
        onApproveSelected={() => {
          void onApproveSelected();
        }}
        onToggleAll={onToggleAllVisible}
        allSelected={allVisibleSelected}
        isBusy={isReviewSubmitting}
        label="approval(s)"
      />

      <div className="mt-4 grid gap-4 md:hidden">
        {isLoading ? (
          <Card className="gap-0 rounded-[1.2rem] border-(--stroke-soft) bg-white/90 py-0 shadow-none">
            <CardContent className="px-4 py-5">
              <Spinner label="Loading approval queue..." />
            </CardContent>
          </Card>
        ) : items.length > 0 ? (
          items.map((item) => (
            <Card
              key={item.selectionKey}
              className="gap-4 rounded-[1.2rem] border-(--stroke-soft) bg-white/90 py-4 shadow-none"
            >
              <CardHeader className="px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedIds.includes(item.selectionKey)}
                      onCheckedChange={(checked) =>
                        onToggleSelected(item.selectionKey, checked === true)
                      }
                      aria-label={`Select ${item.title}`}
                    />
                    <div className="space-y-1">
                      <CardTitle className="text-base">{item.title}</CardTitle>
                      <CardDescription>
                        {item.kind} · {item.ownerName}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className={statusClassName(item.status)}>
                    {item.status}
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
                      {currency(item.amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-(--text-secondary)">
                      Effective date
                    </p>
                    <p className="mt-1 font-medium text-foreground">
                      {new Date(item.effectiveDate).toLocaleDateString("en-BD")}
                    </p>
                  </div>
                </div>
                <div className="space-y-1 text-sm text-(--text-secondary)">
                  <p>{item.subtitle}</p>
                  <p>
                    {item.approvalCount}/{item.requiredApprovalCount} approvals
                  </p>
                  {item.note?.trim() ? <p>{item.note}</p> : null}
                </div>
              </CardContent>
              <CardFooter className="grid grid-cols-2 gap-2 px-4">
                <Button
                  size="sm"
                  disabled={isReviewSubmitting}
                  onClick={() => void onReviewOne(item, "approved")}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isReviewSubmitting}
                  onClick={() => void onReviewOne(item, "rejected")}
                >
                  Reject
                </Button>
              </CardFooter>
            </Card>
          ))
        ) : (
          <Card className="gap-0 rounded-[1.2rem] border-(--stroke-soft) bg-white/90 py-0 shadow-none">
            <CardContent className="px-4 py-5 text-sm text-(--text-secondary)">
              No pending approvals match current filters.
            </CardContent>
          </Card>
        )}
      </div>

      <div className="mt-4 hidden overflow-x-auto rounded-[1.2rem] ring-1 ring-(--stroke-soft) md:block">
        <table className="w-full min-w-240 text-sm">
          <thead className="bg-(--surface-accent-soft)">
            <tr>
              <th className="px-3 py-2 text-center font-semibold">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={() => onToggleAllVisible()}
                  aria-label="Select all visible approvals"
                  disabled={items.length === 0}
                />
              </th>
              <th className="px-3 py-2 text-left font-semibold">Type</th>
              <th className="px-3 py-2 text-left font-semibold">Title</th>
              <th className="px-3 py-2 text-left font-semibold">Owner</th>
              <th className="px-3 py-2 text-left font-semibold">Date</th>
              <th className="px-3 py-2 text-right font-semibold">Amount</th>
              <th className="px-3 py-2 text-left font-semibold">Progress</th>
              <th className="px-3 py-2 text-left font-semibold">Note</th>
              <th className="px-3 py-2 text-center font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-(--stroke-soft) bg-white/70">
            {isLoading ? (
              <tr>
                <td className="px-3 py-8" colSpan={9}>
                  <Spinner label="Loading approval queue..." />
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.selectionKey} className="align-top">
                  <td className="px-3 py-3 text-center">
                    <Checkbox
                      checked={selectedIds.includes(item.selectionKey)}
                      onCheckedChange={(checked) =>
                        onToggleSelected(item.selectionKey, checked === true)
                      }
                      aria-label={`Select ${item.title}`}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex rounded-full bg-(--surface-accent-soft) px-2.5 py-1 text-xs font-semibold uppercase tracking-widest text-(--text-secondary)">
                      {item.kind}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-medium text-foreground">
                    <div>{item.title}</div>
                    <div className="mt-1 text-xs text-(--text-secondary)">
                      {item.subtitle}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-(--text-secondary)">
                    {item.ownerName}
                  </td>
                  <td className="px-3 py-3 text-(--text-secondary)">
                    {new Date(item.effectiveDate).toLocaleDateString("en-BD")}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-foreground">
                    {currency(item.amount)}
                  </td>
                  <td className="px-3 py-3 text-(--text-secondary)">
                    {item.approvalCount}/{item.requiredApprovalCount}
                  </td>
                  <td className="px-3 py-3 text-xs text-(--text-secondary)">
                    {(item.note ?? "").trim() || "-"}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-center gap-2">
                      <Button
                        size="sm"
                        disabled={isReviewSubmitting}
                        onClick={() => void onReviewOne(item, "approved")}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isReviewSubmitting}
                        onClick={() => void onReviewOne(item, "rejected")}
                      >
                        Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
