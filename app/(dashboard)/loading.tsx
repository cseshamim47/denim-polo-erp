import { Spinner } from "@/components/ui/spinner";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <section className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
        <div className="max-w-md space-y-3">
          <div className="h-3 w-28 rounded-full bg-(--surface-accent-soft)" />
          <div className="h-8 w-56 rounded-full bg-(--surface-accent-soft)" />
          <div className="h-4 w-full rounded-full bg-(--surface-accent-soft)" />
          <div className="h-4 w-4/5 rounded-full bg-(--surface-accent-soft)" />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`dashboard-loading-card-${index}`}
            className="rounded-[1.7rem] bg-white/80 p-5 ring-1 ring-(--stroke-soft)"
          >
            <Spinner className="min-h-18" label="Loading page..." />
          </div>
        ))}
      </section>

      <section className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
        <Spinner label="Preparing destination page..." />
      </section>
    </div>
  );
}
