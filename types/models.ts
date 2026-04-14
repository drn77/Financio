export type ColumnType = 'text' | 'number' | 'date' | 'checkbox' | 'select' | 'tag_group' | 'currency' | 'person';

export type DefaultBehavior =
  | 'empty'
  | 'today'
  | 'copy_previous'
  | 'last_used'
  | 'current_user'
  | 'checked'
  | 'unchecked';

export interface IColumnDefinition {
  id: string;
  name: string;
  type: ColumnType;
  required: boolean;
  width?: number;
  options?: string[];
  defaultBehavior: DefaultBehavior;
  currencyOptions?: string[];
}

export interface ITemplate {
  id: string;
  familyId: string;
  createdById: string;
  name: string;
  description: string | null;
  icon: string | null;
  columns: IColumnDefinition[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ITemplateRecord {
  id: string;
  templateId: string;
  data: Record<string, unknown>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface IRecordStats {
  totalRecords: number;
  totalAmount: number;
  averageAmount: number;
  byCategory: { category: string; amount: number; count: number }[];
  byPerson: { person: string; amount: number; count: number }[];
  paidCount: number;
  unpaidCount: number;
}

export interface ICategory {
  id: string;
  familyId: string;
  name: string;
  color: string;
  icon: string | null;
  sortOrder: number;
}

export interface IFamilyMember {
  id: string;
  userId: string;
  familyId: string;
  role: string;
  nickname: string | null;
  username: string;
  firstName: string | null;
  lastName: string | null;
}

export type BillStatus = 'UPCOMING' | 'DUE_TODAY' | 'OVERDUE' | 'PARTIALLY_PAID' | 'PAID';
export type PaymentType = 'MANUAL' | 'AUTO_PAY' | 'DIRECT_DEBIT';
export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export interface IBillTag {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  groupName: string | null;
}

export interface IBillPayment {
  id: string;
  billId: string;
  amount: number;
  paidAt: string;
  dueDate: string;
  notes: string | null;
}

export interface IBillPaymentStats {
  averageAmount: number;
  lastPaymentDate: string | null;
  totalPaid: number;
  paymentCount: number;
}

export interface IBill {
  id: string;
  familyId: string;
  name: string;
  amount: number;
  currency: string;
  dueDay: number;
  paymentStartDate: string;
  paymentEndDate: string | null;
  frequency: Frequency;
  notes: string | null;
  isActive: boolean;
  paymentType: PaymentType;
  autoCreateExpense: boolean;
  reminderDays: number;
  budgetLimit: number | null;
  tagBeforePaymentId: string | null;
  tagAfterPaymentId: string | null;
  savingsGoalId: string | null;
  savingsGoal: { id: string; name: string } | null;
  tagBeforePayment: IBillTag | null;
  tagAfterPayment: IBillTag | null;
  tags: IBillTag[];
  payments: IBillPayment[];
  nextDueDate?: string;
  isPaidThisMonth?: boolean;
  paidAmount?: number;
  remainingAmount?: number;
  status?: BillStatus;
  paymentStats?: IBillPaymentStats;
  createdAt: string;
  updatedAt: string;
}

export interface IBillStats {
  totalBills: number;
  totalMonthly: number;
  activeBills: number;
}

export interface IReceiptItem {
  id: string;
  receiptId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  categoryId: string | null;
}

export interface IReceiptTag {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  groupName: string | null;
}

export interface IReceipt {
  id: string;
  familyId: string;
  userId: string;
  storeId: string | null;
  billId: string | null;
  description: string;
  amount: number;
  currency: string;
  date: string;
  categoryId: string | null;
  personId: string | null;
  imageUrl: string | null;
  notes: string | null;
  configurableFields?: Record<string, unknown> | null;
  ocrStatus: 'PENDING' | 'COMPLETED' | 'FAILED';
  ocrError: string | null;
  isApproved: boolean;
  approvedAt: string | null;
  items: IReceiptItem[];
  tags: IReceiptTag[];
  createdAt: string;
  updatedAt: string;
}

export interface IReceiptStats {
  totalReceipts: number;
  totalAmount: number;
  averageAmount: number;
  byCategory: { category: string; amount: number; count: number }[];
  byStore: { store: string; amount: number; count: number }[];
  topItems: { name: string; totalSpent: number; count: number }[];
}

export interface IStore {
  id: string;
  familyId: string;
  name: string;
  defaultCategoryId: string | null;
  icon: string | null;
  address: string | null;
  notes: string | null;
  receiptCount?: number;
  totalSpent?: number;
  averageReceipt?: number;
  lastVisit?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IBudgetCategory {
  id: string;
  budgetId: string;
  categoryId: string;
  categoryName?: string;
  categoryColor?: string;
  limitAmount: number;
  spentAmount?: number;
  progress?: number;
}

export interface IBudget {
  id: string;
  familyId: string;
  name: string;
  month: number;
  year: number;
  categories: IBudgetCategory[];
  totalLimit?: number;
  totalSpent?: number;
  createdAt: string;
  updatedAt: string;
}

export interface IFixedExpense {
  id: string;
  familyId: string;
  name: string;
  amount: number;
  currency: string;
  frequency: string;
  dayOfMonth: number | null;
  startDate: string;
  endDate: string | null;
  categoryId: string | null;
  personId: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface ISavingsGoal {
  id: string;
  familyId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  deadline: string | null;
  icon: string | null;
  color: string;
  progress: number;
  autoCreateExpense: boolean;
  paymentTagId: string | null;
  paymentTemplateData: Record<string, any> | null;
}

export interface ISavingsDeposit {
  id: string;
  goalId: string;
  userId: string;
  amount: number;
  date: string;
  notes: string | null;
}

export interface IDashboardData {
  monthlyIncome: number;
  monthlyExpenses: number;
  balance: number;
  upcomingBills: IBill[];
  recentTransactions: ITemplateRecord[];
  expensesByCategory: { category: string; color: string; amount: number }[];
  expensesByPerson: { person: string; amount: number }[];
}

// ─── Billing Periods ────────────────────────────────

export type BillingPeriodType = 'DAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'HALF_YEAR' | 'YEAR';

export interface IBillingPeriodConfig {
  type: BillingPeriodType;
  resetHour?: number;        // DAY → hour (0-23)
  resetDayOfWeek?: number;   // WEEK → 1(Mon)-7(Sun)
  resetDayOfMonth?: number;  // MONTH → 1-31
  resetMonth?: number;       // QUARTER, HALF_YEAR, YEAR → 1-12
  resetDay?: number;         // QUARTER, HALF_YEAR, YEAR → 1-31
  budgetAmount?: number;     // Optional budget per period
}

export interface IBillingPeriodOverride {
  id: string;
  templateId: string;
  periodStart: string;
  overrideResetDate: string;
  createdAt: string;
}

export interface IBillingPeriodInfo {
  periodStart: string;   // ISO date
  periodEnd: string;     // ISO date (next reset)
  nextReset: string;     // ISO date
  progress: number;      // 0-1 how far through the period
  daysTotal: number;
  daysRemaining: number;
  isOverridden: boolean;
}

export interface IPeriodHistoryEntry {
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  recordCount: number;
  budgetAmount?: number;
}

// ─── Events ─────────────────────────────────────────

export type EventStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type EventItemStatus = 'PENDING' | 'BOUGHT' | 'SKIPPED';
export type TodoPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface IEventItem {
  id: string;
  eventId: string;
  name: string;
  quantity: number;
  estimatedPrice: number | null;
  actualPrice: number | null;
  categoryId: string | null;
  assignedToId: string | null;
  assignedToName?: string | null;
  status: EventItemStatus;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface IEventTodo {
  id: string;
  eventId: string;
  title: string;
  description: string | null;
  assignedToId: string | null;
  assignedToName?: string | null;
  dueDate: string | null;
  priority: TodoPriority;
  isCompleted: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface IEventNote {
  id: string;
  eventId: string;
  title: string;
  content: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface IEventExpense {
  id: string;
  eventId: string;
  receiptId: string | null;
  name: string;
  amount: number;
  currency: string;
  date: string;
  categoryId: string | null;
  categoryName?: string | null;
  personId: string | null;
  personName?: string | null;
  notes: string | null;
  createdAt: string;
}

export interface IEvent {
  id: string;
  familyId: string;
  createdById: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  budgetLimit: number | null;
  currency: string;
  color: string;
  icon: string | null;
  location: string | null;
  status: EventStatus;
  items: IEventItem[];
  todos: IEventTodo[];
  notes: IEventNote[];
  expenses: IEventExpense[];
  // Computed
  totalEstimated?: number;
  totalActual?: number;
  totalExpenses?: number;
  itemsBought?: number;
  itemsTotal?: number;
  todosCompleted?: number;
  todosTotal?: number;
  daysUntil?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface IEventStats {
  totalEvents: number;
  activeEvents: number;
  totalBudget: number;
  totalSpent: number;
  upcomingCount: number;
}

// ─── Split (Expense Sharing) ────────────────────────

export type SplitStatus = 'ACTIVE' | 'SETTLED' | 'ARCHIVED';

export interface ISplitParticipant {
  id: string;
  splitId: string;
  userId: string | null;
  nickname: string;
  email: string | null;
  isAdmin: boolean;
  isSettled: boolean;
  createdAt: string;
}

export interface ISplitItemClaim {
  id: string;
  splitReceiptItemId: string;
  participantId: string;
  participant: ISplitParticipant;
  createdAt: string;
}

export interface ISplitReceiptItem {
  id: string;
  splitReceiptId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  sortOrder: number;
  claims: ISplitItemClaim[];
}

export interface ISplitReceipt {
  id: string;
  splitId: string;
  uploadedByParticipantId: string;
  paidByParticipantId: string;
  paidBy: ISplitParticipant;
  imageUrl: string | null;
  storeName: string | null;
  totalAmount: number;
  isConfirmed: boolean;
  ocrRawText: string | null;
  items: ISplitReceiptItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ISplitMessage {
  id: string;
  splitId: string;
  participantId: string;
  participant: ISplitParticipant;
  content: string | null;
  type: 'TEXT' | 'RECEIPT';
  splitReceiptId: string | null;
  createdAt: string;
}

export interface ISplit {
  id: string;
  eventId: string;
  inviteCode: string;
  name: string;
  currency: string;
  status: SplitStatus;
  participants: ISplitParticipant[];
  messages: ISplitMessage[];
  receipts: ISplitReceipt[];
  createdAt: string;
  updatedAt: string;
}

export interface ISplitSettlement {
  fromParticipantId: string;
  fromNickname: string;
  toParticipantId: string;
  toNickname: string;
  amount: number;
}

export interface ISplitSummary {
  settlements: ISplitSettlement[];
  participants: ISplitParticipant[];
}

export interface ISplitPreview {
  id: string;
  name: string;
  status: SplitStatus;
  participantCount: number;
}

export interface IJoinSplitResult {
  participant: ISplitParticipant;
  guestToken: string | null;
  split: ISplit;
}
