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
  approvalKindOptions,
  approvalSortOptions,
  type ApprovalFiltersState,
  type ApprovalsResponse,
} from "../approval-types";

export function ApprovalFilters({
  filters,
  onChange,
  openField,
  setOpenField,
  data,
}: {
  filters: ApprovalFiltersState;
  onChange: (next: ApprovalFiltersState) => void;
  openField: string | null;
  setOpenField: (value: string | null) => void;
  data: ApprovalsResponse | null;
}) {
  return (
    <section className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-xl font-semibold tracking-tight">Filters</h3>
          <p className="mt-1 text-sm text-(--text-secondary)">
            Narrow queue by module, owner, keyword, or sort order.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange({
              kind: "",
              owner: "",
              search: "",
              sort: "newest",
            })
          }
        >
          Reset
        </Button>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Input
          className="field h-auto rounded-2xl px-4 py-3"
          placeholder="Search title, owner, note"
          value={filters.search}
          onChange={(event) =>
            onChange({ ...filters, search: event.target.value })
          }
        />

        <Popover
          open={openField === "kind"}
          onOpenChange={(open) => setOpenField(open ? "kind" : null)}
        >
          <PopoverTrigger asChild>
            <button
              className="field flex items-center justify-between rounded-2xl px-4 py-3 text-left"
              type="button"
            >
              <span>
                {approvalKindOptions.find((option) => option.value === filters.kind)
                  ?.label ?? "All modules"}
              </span>
              <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[--radix-popover-trigger-width] p-0"
            align="start"
          >
            <Command>
              <CommandInput placeholder="Search module..." />
              <CommandList>
                <CommandEmpty>No module found.</CommandEmpty>
                <CommandGroup>
                  {approvalKindOptions.map((option) => (
                    <CommandItem
                      key={option.label}
                      value={option.label}
                      onSelect={() => {
                        onChange({
                          ...filters,
                          kind: option.value,
                        });
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
              <CommandInput placeholder="Search owner..." />
              <CommandList>
                <CommandEmpty>No owner found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="All partners"
                    onSelect={() => {
                      onChange({ ...filters, owner: "" });
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
                        onChange({ ...filters, owner: partner.id });
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
          open={openField === "sort"}
          onOpenChange={(open) => setOpenField(open ? "sort" : null)}
        >
          <PopoverTrigger asChild>
            <button
              className="field flex items-center justify-between rounded-2xl px-4 py-3 text-left"
              type="button"
            >
              <span>
                {approvalSortOptions.find((option) => option.value === filters.sort)
                  ?.label ?? "Newest first"}
              </span>
              <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[--radix-popover-trigger-width] p-0"
            align="start"
          >
            <Command>
              <CommandList>
                <CommandGroup>
                  {approvalSortOptions.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onSelect={() => {
                        onChange({ ...filters, sort: option.value });
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
      </div>
    </section>
  );
}
