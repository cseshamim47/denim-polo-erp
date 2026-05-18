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
            Switch between your queue and partner backlog, then narrow by module,
            owner, keyword, or sort order.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange({
              view: "mine",
              pendingPartner: "",
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
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={filters.view === "mine" ? "default" : "outline"}
          className={
            filters.view === "mine"
              ? "bg-foreground text-white"
              : "border-amber-200 bg-white text-foreground"
          }
          onClick={() =>
            onChange({
              ...filters,
              view: "mine",
              pendingPartner: "",
            })
          }
        >
          My pending approvals
        </Button>
        <Button
          type="button"
          variant={filters.view === "partners" ? "default" : "outline"}
          className={
            filters.view === "partners"
              ? "bg-amber-500 text-white hover:bg-amber-600"
              : "border-amber-200 bg-white text-foreground"
          }
          onClick={() =>
            onChange({
              ...filters,
              view: "partners",
            })
          }
        >
          Other partners pending
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
                      ?.name ?? "All owners")
                  : "All owners"}
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
                    value="All owners"
                    onSelect={() => {
                      onChange({ ...filters, owner: "" });
                      setOpenField(null);
                    }}
                  >
                    All owners
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

        {filters.view === "partners" ? (
          <Popover
            open={openField === "pending-partner"}
            onOpenChange={(open) => setOpenField(open ? "pending-partner" : null)}
          >
            <PopoverTrigger asChild>
              <button
                className="field flex items-center justify-between rounded-2xl px-4 py-3 text-left"
                type="button"
              >
                <span>
                  {filters.pendingPartner
                    ? (data?.partners.find(
                        (partner) => partner.id === filters.pendingPartner,
                      )?.name ?? "All pending partners")
                    : "All pending partners"}
                </span>
                <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[--radix-popover-trigger-width] p-0"
              align="start"
            >
              <Command>
                <CommandInput placeholder="Search pending partner..." />
                <CommandList>
                  <CommandEmpty>No partner found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="All pending partners"
                      onSelect={() => {
                        onChange({ ...filters, pendingPartner: "" });
                        setOpenField(null);
                      }}
                    >
                      All pending partners
                    </CommandItem>
                    {(data?.partnerPendingCounts ?? []).map((partner) => (
                      <CommandItem
                        key={partner.partnerId}
                        value={partner.partnerName}
                        onSelect={() => {
                          onChange({
                            ...filters,
                            pendingPartner: partner.partnerId,
                          });
                          setOpenField(null);
                        }}
                      >
                        {partner.partnerName} ({partner.pendingCount})
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : null}

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
