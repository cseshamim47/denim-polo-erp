import { type HistoryResponse } from "../history-types";

export function HistorySummary({
  data,
  isLoading,
}: {
  data: HistoryResponse | null;
  isLoading: boolean;
}) {
  const items = data?.items ?? [];
  const cards = [
    { label: "Visible events", value: items.length },
    { label: "Total events", value: data?.pagination.total ?? 0 },
    {
      label: "Actors",
      value: data?.actors.length ?? 0,
    },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-3">
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
    </section>
  );
}
