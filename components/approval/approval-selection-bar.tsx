"use client";

import { CheckCheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ApprovalSelectionBar({
  selectedCount,
  selectableCount = selectedCount,
  onApproveSelected,
  onToggleAll,
  allSelected = false,
  isBusy = false,
  label = "selected",
}: {
  selectedCount: number;
  selectableCount?: number;
  onApproveSelected: () => void;
  onToggleAll?: () => void;
  allSelected?: boolean;
  isBusy?: boolean;
  label?: string;
}) {
  if (selectableCount <= 0) {
    return null;
  }

  return (
    <div className="sticky top-3 z-10 mb-4 flex flex-col gap-3 rounded-[1.2rem] border border-emerald-200 bg-emerald-50/90 p-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="text-sm font-medium text-emerald-900">
          {selectableCount} item(s) still need your approval
        </p>
        <p className="text-xs text-emerald-800/80">
          {selectedCount} {label} ready now
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {onToggleAll ? (
          <Button
            size="sm"
            variant="outline"
            className="border-emerald-200 bg-white/80 text-emerald-900 hover:bg-white"
            disabled={isBusy}
            onClick={onToggleAll}
            type="button"
          >
            {allSelected ? "Clear selection" : "Select visible"}
          </Button>
        ) : null}
        <Button
          size="sm"
          className="bg-emerald-600 text-white hover:bg-emerald-700"
          disabled={isBusy || selectedCount <= 0}
          onClick={onApproveSelected}
          type="button"
        >
          <CheckCheckIcon className="size-4" />
          Approve selected
        </Button>
      </div>
    </div>
  );
}
