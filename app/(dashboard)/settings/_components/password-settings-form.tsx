"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export function PasswordSettingsForm() {
  const [form, setForm] = useState(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const loadingToastId = toast.loading("Updating password...");

    try {
      const response = await fetch("/api/settings/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; success?: boolean }
        | null;

      toast.dismiss(loadingToastId);

      if (!response.ok) {
        toast.error(payload?.error ?? "Password update failed.");
        return;
      }

      setForm(initialState);
      toast.success("Password updated.");
    } finally {
      toast.dismiss(loadingToastId);
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submitPassword}>
      <div className="grid gap-2">
        <label
          className="text-sm font-medium text-foreground"
          htmlFor="settings-current-password"
        >
          Current password
        </label>
        <Input
          id="settings-current-password"
          className="h-11 rounded-2xl px-4"
          type="password"
          autoComplete="current-password"
          value={form.currentPassword}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              currentPassword: event.target.value,
            }))
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <label
            className="text-sm font-medium text-foreground"
            htmlFor="settings-new-password"
          >
            New password
          </label>
          <Input
            id="settings-new-password"
            className="h-11 rounded-2xl px-4"
            type="password"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                newPassword: event.target.value,
              }))
            }
          />
        </div>

        <div className="grid gap-2">
          <label
            className="text-sm font-medium text-foreground"
            htmlFor="settings-confirm-password"
          >
            Retype new password
          </label>
          <Input
            id="settings-confirm-password"
            className="h-11 rounded-2xl px-4"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                confirmPassword: event.target.value,
              }))
            }
          />
        </div>
      </div>

      <div className="rounded-[1.3rem] border border-(--stroke-soft) bg-white/70 px-4 py-3 text-sm leading-6 text-(--text-secondary)">
        Password sign-in works for both partners and salesmen. Partner Google
        access stays available separately.
      </div>

      <div className="flex justify-end">
        <Button
          className="w-full rounded-full sm:w-auto"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Saving..." : "Change password"}
        </Button>
      </div>
    </form>
  );
}
