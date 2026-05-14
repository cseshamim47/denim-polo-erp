"use client";

import { useState } from "react";
import { ChevronsUpDownIcon } from "lucide-react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import type { AssetFormState } from "../asset-types";

export function AssetForm({
  categorySuggestions,
  form,
  onChange,
  onSubmitted,
}: {
  categorySuggestions: string[];
  form: AssetFormState;
  onChange: (next: AssetFormState) => void;
  onSubmitted: () => Promise<void>;
}) {
  const [openCategory, setOpenCategory] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitAsset() {
    const trimmedTitle = form.title.trim();
    const trimmedCategory = form.category.trim();
    const numericAmount = Number(form.amount);

    if (!trimmedTitle) {
      toast.error("Title is required.");
      return;
    }

    if (!trimmedCategory) {
      toast.error("Category is required.");
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error("Enter a valid amount greater than 0.");
      return;
    }

    setIsSubmitting(true);
    const loadingToastId = toast.loading("Saving asset...");

    try {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          category: trimmedCategory,
          amount: numericAmount,
          assetDate: form.assetDate,
          note: form.note.trim(),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; assetId?: string }
        | null;

      toast.dismiss(loadingToastId);

      if (!response.ok) {
        toast.error(payload?.error ?? "Asset save failed.");
        return;
      }

      onChange({
        title: "",
        category: "",
        amount: "",
        assetDate: new Date().toISOString().slice(0, 10),
        note: "",
      });
      toast.success(`Asset sent: ${payload?.assetId ?? "saved"}`);
      await onSubmitted();
    } finally {
      toast.dismiss(loadingToastId);
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
      <h3 className="text-xl font-semibold tracking-tight">Submit asset</h3>
      <div className="mt-4 grid gap-4">
        <Input
          className="field h-auto rounded-2xl px-4 py-3"
          placeholder="Asset title"
          value={form.title}
          onChange={(event) =>
            onChange({ ...form, title: event.target.value })
          }
        />

        <Popover
          open={openCategory}
          onOpenChange={(open) => {
            setOpenCategory(open);
            if (open) {
              setCategorySearch("");
            }
          }}
        >
          <PopoverTrigger asChild>
            <button
              className="field flex items-center justify-between rounded-2xl px-4 py-3 text-left"
              type="button"
            >
              <span>{form.category.trim() || "Category"}</span>
              <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[--radix-popover-trigger-width] p-0"
            align="start"
          >
            <Command>
              <CommandInput
                placeholder="Search or enter category..."
                value={categorySearch}
                onValueChange={setCategorySearch}
              />
              <CommandList>
                <CommandEmpty>Type a new category or pick one below.</CommandEmpty>
                <CommandGroup>
                  {categorySearch.trim() &&
                  !categorySuggestions.some(
                    (category) =>
                      category.toLowerCase() ===
                      categorySearch.trim().toLowerCase(),
                  ) ? (
                    <CommandItem
                      value={categorySearch}
                      onSelect={() => {
                        onChange({
                          ...form,
                          category: categorySearch.trim().toUpperCase(),
                        });
                        setOpenCategory(false);
                      }}
                    >
                      Use &quot;{categorySearch.trim()}&quot;
                    </CommandItem>
                  ) : null}
                  {categorySuggestions.map((category) => (
                    <CommandItem
                      key={category}
                      value={category}
                      onSelect={() => {
                        onChange({ ...form, category });
                        setOpenCategory(false);
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
          min={1}
          placeholder="Amount"
          type="number"
          value={form.amount}
          onChange={(event) =>
            onChange({ ...form, amount: event.target.value })
          }
        />

        <Input
          className="field h-auto rounded-2xl px-4 py-3"
          type="date"
          value={form.assetDate}
          onChange={(event) =>
            onChange({ ...form, assetDate: event.target.value })
          }
        />

        <Textarea
          className="field min-h-32 rounded-2xl px-4 py-3"
          placeholder="Asset note, source, vendor, reason"
          value={form.note}
          onChange={(event) => onChange({ ...form, note: event.target.value })}
        />
      </div>
      <Button
        className="mt-4 w-full rounded-full sm:w-auto"
        onClick={() => void submitAsset()}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Submitting..." : "Submit asset"}
      </Button>
    </section>
  );
}
