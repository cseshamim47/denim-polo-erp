"use client";

import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  type HistoryFiltersState,
  type HistoryResponse,
} from "../history-types";

function SnapshotBlock({
  label,
  value,
}: {
  label: string;
  value: Record<string, unknown> | null;
}) {
  if (!value) {
    return null;
  }

  return (
    <div className="rounded-xl bg-(--surface-accent-soft) p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-(--text-secondary)">
        {label}
      </p>
      <pre className="mt-2 overflow-x-auto text-xs text-foreground">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export function HistoryList({
  data,
  isLoading,
  filters,
  onChangeFilters,
}: {
  data: HistoryResponse | null;
  isLoading: boolean;
  filters: HistoryFiltersState;
  onChangeFilters: (next: HistoryFiltersState) => void;
}) {
  const [openIds, setOpenIds] = useState<string[]>([]);
  const items = data?.items ?? [];

  function toggleOpen(id: string) {
    setOpenIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  if (isLoading) {
    return (
      <section className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
        <Spinner label="Loading history..." />
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="rounded-[1.8rem] bg-white/80 p-6 text-sm text-(--text-secondary) ring-1 ring-(--stroke-soft)">
        No history events match current filters.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {items.map((item) => {
        const isOpen = openIds.includes(item.id);

        return (
          <Card
            key={item.id}
            className="rounded-[1.4rem] border-(--stroke-soft) bg-white/90 shadow-none"
          >
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{item.summary}</CardTitle>
                  <p className="mt-1 text-sm text-(--text-secondary)">
                    {item.actorName} · {item.module} · {item.action} ·{" "}
                    {new Date(item.createdAt).toLocaleString("en-BD")}
                  </p>
                </div>
                <button
                  className="btn-secondary"
                  onClick={() => toggleOpen(item.id)}
                  type="button"
                >
                  {isOpen ? "Hide details" : "Show details"}
                </button>
              </div>
            </CardHeader>
            {isOpen ? (
              <CardContent className="grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <SnapshotBlock label="Before" value={item.before} />
                  <SnapshotBlock label="After" value={item.after} />
                </div>
                {item.meta ? <SnapshotBlock label="Meta" value={item.meta} /> : null}
              </CardContent>
            ) : null}
          </Card>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] bg-white/80 px-4 py-4 ring-1 ring-(--stroke-soft)">
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
