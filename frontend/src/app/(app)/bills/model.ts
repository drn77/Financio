import type { IBill, IBillTag, Frequency, PaymentType, BillStatus } from '@shared/models';

export interface IBillFormData {
  name: string;
  amount: string;
  dueDay: string;
  paymentStartDate: string;
  paymentEndDate: string;
  frequency: Frequency;
  notes: string;
  paymentType: PaymentType;
  autoCreateExpense: boolean;
  reminderDays: string;
  budgetLimit: string;
  tagBeforePaymentId: string;
  tagAfterPaymentId: string;
  tagIds: string[];
}

export interface ITagOption {
  id: string;
  name: string;
  color: string;
  groupName: string;
}

export interface IFilterState {
  status: BillStatus | 'ALL';
  tagIds: string[];
  search: string;
}

export const EMPTY_FORM: IBillFormData = {
  name: '',
  amount: '',
  dueDay: '',
  paymentStartDate: '',
  paymentEndDate: '',
  frequency: 'MONTHLY',
  notes: '',
  paymentType: 'MANUAL',
  autoCreateExpense: false,
  reminderDays: '3',
  budgetLimit: '',
  tagBeforePaymentId: '',
  tagAfterPaymentId: '',
  tagIds: [],
};

export type SortField = 'name' | 'amount' | 'dueDay' | 'status';
export type SortDirection = 'asc' | 'desc';

export const SORT_LABELS: Record<SortField, string> = {
  name: 'Nazwa',
  amount: 'Kwota',
  dueDay: 'Termin',
  status: 'Status',
};

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  DAILY: 'Codziennie',
  WEEKLY: 'Tygodniowo',
  MONTHLY: 'Miesięcznie',
  QUARTERLY: 'Kwartalnie',
  YEARLY: 'Rocznie',
};

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  MANUAL: 'Ręczna płatność',
  AUTO_PAY: 'Autopłatność',
  DIRECT_DEBIT: 'Polecenie zapłaty',
};

export const STATUS_LABELS: Record<BillStatus, string> = {
  UPCOMING: 'Nadchodzący',
  DUE_TODAY: 'Termin dziś',
  OVERDUE: 'Zaległy',
  PARTIALLY_PAID: 'Częściowo opłacony',
  PAID: 'Opłacony',
};

export const STATUS_COLORS: Record<BillStatus, string> = {
  UPCOMING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  DUE_TODAY: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  OVERDUE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  PARTIALLY_PAID: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  PAID: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
};

export type { IBill, IBillTag, Frequency, PaymentType, BillStatus };
