"use client";

import { Input } from "@/components/ui/input";
import {
  type HistoryFiltersState,
  type HistoryResponse,
  moduleOptions,
} from "../history-types";

export function HistoryFilters({
  filters,
  onChange,
  data,
}: {
  filters: HistoryFiltersState;
  onChange: (next: HistoryFiltersState) => void;
  data: HistoryResponse | null;
}) {
  return (
    <section className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-xl font-semibold tracking-tight">Filters</h3>
          <p className="mt-1 text-sm text-(--text-secondary)">
            Search audit trail by module, actor, action, and dates.
          </p>
        </div>
        <button
          className="btn-secondary"
          onClick={() =>
            onChange({
              page: 1,
              search: "",
              module: "",
              action: "",
              actor: "",
              from: "",
              to: "",
            })
          }
          type="button"
        >
          Reset
        </button>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Input
          className="field h-auto rounded-2xl px-4 py-3"
          placeholder="Search summary, entity, actor"
          value={filters.search}
          onChange={(event) =>
            onChange({ ...filters, page: 1, search: event.target.value })
          }
        />
        <select
          className="field rounded-2xl px-4 py-3 text-foreground"
          value={filters.module}
          onChange={(event) =>
            onChange({ ...filters, page: 1, module: event.target.value })
          }
        >
          {moduleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Input
          className="field h-auto rounded-2xl px-4 py-3"
          placeholder="Action (create, approve, reject)"
          value={filters.action}
          onChange={(event) =>
            onChange({ ...filters, page: 1, action: event.target.value })
          }
        />
        <select
          className="field rounded-2xl px-4 py-3 text-foreground"
          value={filters.actor}
          onChange={(event) =>
            onChange({ ...filters, page: 1, actor: event.target.value })
          }
        >
          <option value="">All actors</option>
          {(data?.actors ?? []).map((actor) => (
            <option key={actor.id} value={actor.id}>
              {actor.name} ({actor.role})
            </option>
          ))}
        </select>
        <Input
          className="field h-auto rounded-2xl px-4 py-3"
          type="date"
          value={filters.from}
          onChange={(event) =>
            onChange({ ...filters, page: 1, from: event.target.value })
          }
        />
        <Input
          className="field h-auto rounded-2xl px-4 py-3"
          type="date"
          value={filters.to}
          onChange={(event) =>
            onChange({ ...filters, page: 1, to: event.target.value })
          }
        />
      </div>
    </section>
  );
}
