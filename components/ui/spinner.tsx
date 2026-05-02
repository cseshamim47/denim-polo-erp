import { LoaderCircleIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type SpinnerProps = {
  className?: string;
  label?: string;
};

export function Spinner({
  className,
  label = "Loading...",
}: SpinnerProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 text-sm text-(--text-secondary)",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <LoaderCircleIcon className="size-4 animate-spin" />
      <span>{label}</span>
    </div>
  );
}