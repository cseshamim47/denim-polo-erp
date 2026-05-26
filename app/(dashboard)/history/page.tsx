"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { HistoryFilters } from "./_components/history-filters";
import { HistoryList } from "./_components/history-list";
import { HistorySummary } from "./_components/history-summary";
import {
  readJsonResponse,
  type HistoryFiltersState,
  type HistoryResponse,
} from "./history-types";

const initialFilters: HistoryFiltersState = {
  search: "",
  module: "",
  action: "",
  actor: "",
  from: "",
  to: "",
};

function buildHistoryQuery(filters: HistoryFiltersState) {
  const params = new URLSearchParams();

  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.module) params.set("module", filters.module);
  if (filters.action.trim()) params.set("action", filters.action.trim());
  if (filters.actor) params.set("actor", filters.actor);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);

  return params.toString();
}

export default function HistoryPage() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [filters, setFilters] = useState<HistoryFiltersState>(initialFilters);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/history?${buildHistoryQuery(filters)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          if (!cancelled) {
            setIsLoading(false);
            toast.error("Unable to load history right now.");
          }
          return;
        }

        const payload = await readJsonResponse<HistoryResponse>(response);

        if (!cancelled) {
          setData(payload);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsLoading(false);
          toast.error("Unable to load history right now.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filters]);

  return (
    <div className="space-y-6">
      <section className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
        <h2 className="text-2xl font-semibold tracking-tight">History</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-(--text-secondary)">
          Audit trail for all future business-changing actions across the system.
        </p>
      </section>

      <HistorySummary data={data} isLoading={isLoading} />
      <HistoryFilters
        data={data}
        filters={filters}
        onChange={(next) => {
          setIsLoading(true);
          setFilters(next);
        }}
      />
      <HistoryList data={data} isLoading={isLoading} />
    </div>
  );
}
