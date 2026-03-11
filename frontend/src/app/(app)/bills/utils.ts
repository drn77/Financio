export const formatPLN = (amount: number): string =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);

export const formatDate = (date: string | Date): string =>
  new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(date),
  );

export const formatShortDate = (date: string | Date): string =>
  new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: 'short' }).format(new Date(date));

export const computeMonthlyEquivalent = (amount: number, frequency: string): number => {
  switch (frequency) {
    case 'DAILY':
      return amount * 30;
    case 'WEEKLY':
      return amount * 4.33;
    case 'MONTHLY':
      return amount;
    case 'QUARTERLY':
      return amount / 3;
    case 'YEARLY':
      return amount / 12;
    default:
      return amount;
  }
};

export const getDaysUntilDue = (dueDay: number): number => {
  const now = new Date();
  const dueDate = new Date(now.getFullYear(), now.getMonth(), dueDay);

  if (dueDate < now) {
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, dueDay);

    return Math.ceil((nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  return Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};
