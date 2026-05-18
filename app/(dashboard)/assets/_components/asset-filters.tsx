"use client";

import { ChevronsUpDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  assetScopeOptions,
  assetStatusOptions,
  type AssetFiltersState,
  type AssetsResponse,
} from "../asset-types";

export function AssetFilters({
  openField,
  setOpenField,
  filters,
  onChange,
  data,
}: {
  openField: string | null;
  setOpenField: (value: string | null) => void;
  filters: AssetFiltersState;
  onChange: (next: AssetFiltersState) => void;
  data: AssetsResponse | null;
}) {
  return (
    <section className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
      <h3 className="text-xl font-semibold tracking-tight">Filters</h3>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={filters.needsReview ? "outline" : "default"}
          className={
            filters.needsReview
              ? "border-amber-200 bg-white text-foreground"
              : "bg-foreground text-white"
          }
          onClick={() => onChange({ ...filters, needsReview: false, page: 1 })}
        >
          All assets
        </Button>
        <Button
          type="button"
          variant={filters.needsReview ? "default" : "outline"}
          className={
            filters.needsReview
              ? "bg-amber-500 text-white hover:bg-amber-600"
              : "border-amber-200 bg-white text-foreground"
          }
          onClick={() => onChange({ ...filters, needsReview: true, page: 1 })}
        >
          Needs my approval
        </Button>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Popover
          open={openField === "scope"}
          onOpenChange={(open) => setOpenField(open ? "scope" : null)}
        >
          <PopoverTrigger asChild>
            <button
              className="field flex items-center justify-between rounded-2xl px-4 py-3 text-left"
              type="button"
            >
              <span>
                {assetScopeOptions.find((option) => option.value === filters.scope)
                  ?.label ?? "All assets"}
              </span>
              <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[--radix-popover-trigger-width] p-0"
            align="start"
          >
            <Command>
              <CommandInput placeholder="Search scope..." />
              <CommandList>
                <CommandEmpty>No scope found.</CommandEmpty>
                <CommandGroup>
                  {assetScopeOptions.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onSelect={() => {
                        onChange({ ...filters, scope: option.value, page: 1 });
                        setOpenField(null);
                      }}
                    >
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Popover
          open={openField === "owner"}
          onOpenChange={(open) => setOpenField(open ? "owner" : null)}
        >
          <PopoverTrigger asChild>
            <button
              className="field flex items-center justify-between rounded-2xl px-4 py-3 text-left"
              type="button"
            >
              <span>
                {filters.owner
                  ? (data?.partners.find((partner) => partner.id === filters.owner)
                      ?.name ?? "All partners")
                  : "All partners"}
              </span>
              <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[--radix-popover-trigger-width] p-0"
            align="start"
          >
            <Command>
              <CommandInput placeholder="Search partner..." />
              <CommandList>
                <CommandEmpty>No partner found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="All partners"
                    onSelect={() => {
                      onChange({ ...filters, owner: "", page: 1 });
                      setOpenField(null);
                    }}
                  >
                    All partners
                  </CommandItem>
                  {(data?.partners ?? []).map((partner) => (
                    <CommandItem
                      key={partner.id}
                      value={`${partner.name} ${partner.email}`}
                      onSelect={() => {
                        onChange({ ...filters, owner: partner.id, page: 1 });
                        setOpenField(null);
                      }}
                    >
                      {partner.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Popover
          open={openField === "status"}
          onOpenChange={(open) => setOpenField(open ? "status" : null)}
        >
          <PopoverTrigger asChild>
            <button
              className="field flex items-center justify-between rounded-2xl px-4 py-3 text-left"
              type="button"
            >
              <span>
                {assetStatusOptions.find(
                  (option) => option.value === filters.status,
                )?.label ?? "All statuses"}
              </span>
              <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[--radix-popover-trigger-width] p-0"
            align="start"
          >
            <Command>
              <CommandInput placeholder="Search status..." />
              <CommandList>
                <CommandEmpty>No status found.</CommandEmpty>
                <CommandGroup>
                  {assetStatusOptions.map((option) => (
                    <CommandItem
                      key={option.label}
                      value={option.label}
                      onSelect={() => {
                        onChange({ ...filters, status: option.value, page: 1 });
                        setOpenField(null);
                      }}
                    >
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Popover
          open={openField === "category"}
          onOpenChange={(open) => setOpenField(open ? "category" : null)}
        >
          <PopoverTrigger asChild>
            <button
              className="field flex items-center justify-between rounded-2xl px-4 py-3 text-left"
              type="button"
            >
              <span>{filters.category || "All categories"}</span>
              <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[--radix-popover-trigger-width] p-0"
            align="start"
          >
            <Command>
              <CommandInput placeholder="Search category..." />
              <CommandList>
                <CommandEmpty>No category found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="All categories"
                    onSelect={() => {
                      onChange({ ...filters, category: "", page: 1 });
                      setOpenField(null);
                    }}
                  >
                    All categories
                  </CommandItem>
                  {(data?.categorySuggestions ?? []).map((category) => (
                    <CommandItem
                      key={category}
                      value={category}
                      onSelect={() => {
                        onChange({ ...filters, category, page: 1 });
                        setOpenField(null);
                      }}
                    >
                      {category}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Input
          className="field h-auto rounded-2xl px-4 py-3"
          type="date"
          value={filters.from}
          onChange={(event) =>
            onChange({ ...filters, from: event.target.value, page: 1 })
          }
        />
        <Input
          className="field h-auto rounded-2xl px-4 py-3"
          type="date"
          value={filters.to}
          onChange={(event) =>
            onChange({ ...filters, to: event.target.value, page: 1 })
          }
        />
      </div>
      <button
        className="btn-secondary mt-4 w-full sm:w-auto"
        onClick={() =>
          onChange({
            page: 1,
            scope: "all",
            owner: "",
            status: "",
            category: "",
            from: "",
            to: "",
            needsReview: false,
          })
        }
        type="button"
      >
        Reset
      </button>
    </section>
  );
}
