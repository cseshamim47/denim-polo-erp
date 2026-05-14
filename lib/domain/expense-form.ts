function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

export function formatDateInputValue(date: Date) {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join("-");
}

export function buildExpenseRequest(input: {
  title: string;
  amount: number;
  note: string;
  expenseDate: string;
}) {
  return {
    title: input.title.trim(),
    amount: input.amount,
    note: input.note.trim(),
    expenseDate: input.expenseDate,
  };
}
