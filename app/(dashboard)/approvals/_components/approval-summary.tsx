import { type ApprovalsResponse } from "../approval-types";

export function ApprovalSummary({
  data,
  isLoading,
}: {
  data: ApprovalsResponse | null;
  isLoading: boolean;
}) {
  const cards = [
    { label: "Total pending", value: data?.summary.total ?? 0 },
    { label: "Purchases", value: data?.summary.purchases ?? 0 },
    { label: "Expenses", value: data?.summary.expenses ?? 0 },
    { label: "Investments", value: data?.summary.investments ?? 0 },
    { label: "Assets", value: data?.summary.assets ?? 0 },
  ];

  return (
    <section className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
      <div className="grid gap-4 md:grid-cols-5">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-[1.7rem] bg-white/80 p-5 ring-1 ring-(--stroke-soft)"
          >
            <p className="text-sm text-(--text-secondary)">{card.label}</p>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-(--text-primary)">
              {isLoading ? "..." : card.value}
            </p>
          </div>
        ))}
      </div>
      <div className="rounded-[1.7rem] bg-white/80 p-5 ring-1 ring-(--stroke-soft)">
        <p className="text-sm text-(--text-secondary)">Partner backlog</p>
        <div className="mt-4 grid gap-2">
          {(data?.partnerPendingCounts ?? []).length > 0 ? (
            (data?.partnerPendingCounts ?? []).slice(0, 6).map((partner) => (
              <div
                key={partner.partnerId}
                className="flex items-center justify-between rounded-xl bg-(--surface-accent-soft) px-3 py-2"
              >
                <span className="text-sm text-foreground">{partner.partnerName}</span>
                <span className="text-sm font-semibold text-foreground">
                  {partner.pendingCount}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-(--text-secondary)">
              {isLoading ? "Loading..." : "No partner backlog."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
