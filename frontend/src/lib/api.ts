import type { ILoginRequest, IRegisterRequest, IUser, ISessionResponse } from '@shared/auth';
import type { IBill, IBillPayment, IBillStats, IRecordStats, IReceipt, IReceiptStats, IStore, IBudget, IEvent, IEventItem, IEventTodo, IEventNote, IEventExpense, IEventStats } from '@shared/models';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

class ApiClient {
  private baseUrl: string;
  private csrfToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setCsrfToken(token: string): void {
    this.csrfToken = token;
  }

  private _getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.csrfToken) {
      headers['X-CSRF-Token'] = this.csrfToken;
    }

    return headers;
  }

  private async _request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...this._getHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async getSession(): Promise<ISessionResponse> {
    return this._request<ISessionResponse>('/api/v2/auth/session');
  }

  async login(input: ILoginRequest): Promise<{ user: IUser; csrfToken: string }> {
    return this._request<{ user: IUser; csrfToken: string }>('/api/v2/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async register(input: IRegisterRequest): Promise<{ user: IUser; csrfToken: string }> {
    return this._request<{ user: IUser; csrfToken: string }>('/api/v2/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async logout(): Promise<void> {
    await this._request<{ message: string }>('/api/v2/auth/logout', {
      method: 'POST',
    });
  }

  async getProfile(): Promise<{ user: IUser }> {
    return this._request<{ user: IUser }>('/api/v2/auth/profile');
  }

  async getAdminUsers(): Promise<{ users: IUser[] }> {
    return this._request<{ users: IUser[] }>('/api/v2/admin/users');
  }

  async getAdminStats(): Promise<{ totalUsers: number; adminCount: number; userCount: number }> {
    return this._request('/api/v2/admin/stats');
  }

  // ─── Templates ────────────────────────────────────
  async getTemplates(): Promise<AnyRecord[]> {
    return this._request('/api/v2/templates');
  }

  async getTemplate(id: string): Promise<AnyRecord> {
    return this._request(`/api/v2/templates/${id}`);
  }

  async getDefaultTemplate(): Promise<AnyRecord> {
    return this._request('/api/v2/templates/default');
  }

  async createTemplate(data: AnyRecord): Promise<AnyRecord> {
    return this._request('/api/v2/templates', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateTemplate(id: string, data: AnyRecord): Promise<AnyRecord> {
    return this._request(`/api/v2/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteTemplate(id: string): Promise<void> {
    await this._request(`/api/v2/templates/${id}`, { method: 'DELETE' });
  }

  // ─── Template Records ─────────────────────────────
  async getRecords(templateId: string, page = 1, limit = 100): Promise<AnyRecord> {
    return this._request(`/api/v2/templates/${templateId}/records?page=${page}&limit=${limit}`);
  }

  async createRecord(templateId: string, data: AnyRecord): Promise<AnyRecord> {
    return this._request(`/api/v2/templates/${templateId}/records`, {
      method: 'POST',
      body: JSON.stringify({ data }),
    });
  }

  async updateRecord(templateId: string, recordId: string, data: AnyRecord): Promise<AnyRecord> {
    return this._request(`/api/v2/templates/${templateId}/records/${recordId}`, {
      method: 'PUT',
      body: JSON.stringify({ data }),
    });
  }

  async deleteRecord(templateId: string, recordId: string): Promise<void> {
    await this._request(`/api/v2/templates/${templateId}/records/${recordId}`, { method: 'DELETE' });
  }

  async bulkUpdateRecords(templateId: string, records: AnyRecord[], deletedIds?: string[]): Promise<AnyRecord[]> {
    return this._request(`/api/v2/templates/${templateId}/records/bulk`, {
      method: 'PUT',
      body: JSON.stringify({ records, deletedIds }),
    });
  }

  async getRecordStats(templateId: string, from?: string, to?: string): Promise<IRecordStats> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return this._request(`/api/v2/templates/${templateId}/records/stats${qs ? `?${qs}` : ''}`);
  }

  async duplicateRecord(templateId: string, recordId: string): Promise<AnyRecord> {
    return this._request(`/api/v2/templates/${templateId}/records/${recordId}/duplicate`, {
      method: 'POST',
    });
  }

  async importRecords(templateId: string, records: { data: AnyRecord; sortOrder?: number }[]): Promise<{ count: number }> {
    return this._request(`/api/v2/templates/${templateId}/records/import`, {
      method: 'POST',
      body: JSON.stringify({ records }),
    });
  }

  // ─── Categories ───────────────────────────────────
  async getCategories(): Promise<AnyRecord[]> {
    return this._request('/api/v2/categories');
  }

  async createCategory(data: AnyRecord): Promise<AnyRecord> {
    return this._request('/api/v2/categories', { method: 'POST', body: JSON.stringify(data) });
  }

  // ─── Tag Groups & Tags ────────────────────────────
  async getTagGroups(): Promise<AnyRecord[]> {
    return this._request('/api/v2/tag-groups');
  }

  async getTagGroup(id: string): Promise<AnyRecord> {
    return this._request(`/api/v2/tag-groups/${id}`);
  }

  async createTagGroup(data: AnyRecord): Promise<AnyRecord> {
    return this._request('/api/v2/tag-groups', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateTagGroup(id: string, data: AnyRecord): Promise<AnyRecord> {
    return this._request(`/api/v2/tag-groups/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteTagGroup(id: string): Promise<void> {
    await this._request(`/api/v2/tag-groups/${id}`, { method: 'DELETE' });
  }

  async createTag(groupId: string, data: AnyRecord): Promise<AnyRecord> {
    return this._request(`/api/v2/tag-groups/${groupId}/tags`, { method: 'POST', body: JSON.stringify(data) });
  }

  async updateTag(groupId: string, tagId: string, data: AnyRecord): Promise<AnyRecord> {
    return this._request(`/api/v2/tag-groups/${groupId}/tags/${tagId}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteTag(groupId: string, tagId: string): Promise<void> {
    await this._request(`/api/v2/tag-groups/${groupId}/tags/${tagId}`, { method: 'DELETE' });
  }

  async reorderTags(groupId: string, tags: { id: string; sortOrder: number }[]): Promise<void> {
    await this._request(`/api/v2/tag-groups/${groupId}/tags/reorder`, { method: 'PUT', body: JSON.stringify({ tags }) });
  }

  // ─── Family ───────────────────────────────────────
  async getFamily(): Promise<AnyRecord> {
    return this._request('/api/v2/family');
  }

  async getFamilyMembers(): Promise<AnyRecord[]> {
    return this._request('/api/v2/family/members');
  }

  async addFamilyMember(email: string): Promise<AnyRecord> {
    return this._request('/api/v2/family/members', { method: 'POST', body: JSON.stringify({ email }) });
  }

  async removeFamilyMember(memberId: string): Promise<void> {
    return this._request(`/api/v2/family/members/${memberId}`, { method: 'DELETE' });
  }

  // ─── Bills ────────────────────────────────────────
  async getBills(active?: boolean): Promise<IBill[]> {
    const params = active !== undefined ? `?active=${active}` : '';

    return this._request(`/api/v2/bills${params}`);
  }

  async getBill(id: string): Promise<IBill> {
    return this._request(`/api/v2/bills/${id}`);
  }

  async getBillStats(): Promise<IBillStats> {
    return this._request('/api/v2/bills/stats');
  }

  async getBillPayments(id: string): Promise<IBillPayment[]> {
    return this._request(`/api/v2/bills/${id}/payments`);
  }

  async createBill(data: AnyRecord): Promise<IBill> {
    return this._request('/api/v2/bills', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateBill(id: string, data: AnyRecord): Promise<IBill> {
    return this._request(`/api/v2/bills/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteBill(id: string): Promise<void> {
    await this._request(`/api/v2/bills/${id}`, { method: 'DELETE' });
  }

  async payBill(id: string, data: AnyRecord): Promise<IBillPayment> {
    return this._request(`/api/v2/bills/${id}/pay`, { method: 'POST', body: JSON.stringify(data) });
  }

  async deleteBillPayment(billId: string, paymentId: string): Promise<void> {
    await this._request(`/api/v2/bills/${billId}/payments/${paymentId}`, { method: 'DELETE' });
  }

  // ─── Receipts ─────────────────────────────────────
  async getReceipts(params?: AnyRecord): Promise<IReceipt[]> {
    const qs = params ? '?' + new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
    ).toString() : '';
    return this._request(`/api/v2/receipts${qs}`);
  }

  async getReceipt(id: string): Promise<IReceipt> {
    return this._request(`/api/v2/receipts/${id}`);
  }

  async getReceiptStats(from?: string, to?: string): Promise<IReceiptStats> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return this._request(`/api/v2/receipts/stats${qs ? `?${qs}` : ''}`);
  }

  async checkReceiptDuplicate(amount: number, date: string): Promise<{ id: string; description: string } | null> {
    return this._request(`/api/v2/receipts/duplicate-check?amount=${amount}&date=${date}`);
  }

  async suggestReceiptCategory(description: string): Promise<{ categoryId: string | null }> {
    return this._request(`/api/v2/receipts/suggest-category?description=${encodeURIComponent(description)}`);
  }

  async createReceipt(data: AnyRecord): Promise<IReceipt> {
    return this._request('/api/v2/receipts', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateReceipt(id: string, data: AnyRecord): Promise<IReceipt> {
    return this._request(`/api/v2/receipts/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async duplicateReceipt(id: string): Promise<IReceipt> {
    return this._request(`/api/v2/receipts/${id}/duplicate`, { method: 'POST' });
  }

  async createExpenseFromReceipt(id: string): Promise<{ message: string }> {
    return this._request(`/api/v2/receipts/${id}/create-expense`, { method: 'POST' });
  }

  async deleteReceipt(id: string): Promise<void> {
    await this._request(`/api/v2/receipts/${id}`, { method: 'DELETE' });
  }

  // ─── Stores ───────────────────────────────────────
  async getStores(): Promise<IStore[]> {
    return this._request('/api/v2/stores');
  }

  async getStore(id: string): Promise<IStore> {
    return this._request(`/api/v2/stores/${id}`);
  }

  async createStore(data: AnyRecord): Promise<IStore> {
    return this._request('/api/v2/stores', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateStore(id: string, data: AnyRecord): Promise<IStore> {
    return this._request(`/api/v2/stores/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteStore(id: string): Promise<void> {
    await this._request(`/api/v2/stores/${id}`, { method: 'DELETE' });
  }

  // ─── Budgets ──────────────────────────────────────
  async getBudgets(year?: number): Promise<IBudget[]> {
    const qs = year ? `?year=${year}` : '';
    return this._request(`/api/v2/budgets${qs}`);
  }

  async getBudget(id: string): Promise<IBudget> {
    return this._request(`/api/v2/budgets/${id}`);
  }

  async getCurrentBudget(): Promise<IBudget | null> {
    return this._request('/api/v2/budgets/current');
  }

  async createBudget(data: AnyRecord): Promise<IBudget> {
    return this._request('/api/v2/budgets', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateBudget(id: string, data: AnyRecord): Promise<IBudget> {
    return this._request(`/api/v2/budgets/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteBudget(id: string): Promise<void> {
    await this._request(`/api/v2/budgets/${id}`, { method: 'DELETE' });
  }

  // ─── Events ───────────────────────────────────────
  async getEvents(params?: AnyRecord): Promise<IEvent[]> {
    const qs = params ? '?' + new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
    ).toString() : '';
    return this._request(`/api/v2/events${qs}`);
  }

  async getEvent(id: string): Promise<IEvent> {
    return this._request(`/api/v2/events/${id}`);
  }

  async getEventStats(): Promise<IEventStats> {
    return this._request('/api/v2/events/stats');
  }

  async getUpcomingEvents(): Promise<IEvent[]> {
    return this._request('/api/v2/events/upcoming');
  }

  async createEvent(data: AnyRecord): Promise<IEvent> {
    return this._request('/api/v2/events', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateEvent(id: string, data: AnyRecord): Promise<IEvent> {
    return this._request(`/api/v2/events/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteEvent(id: string): Promise<void> {
    await this._request(`/api/v2/events/${id}`, { method: 'DELETE' });
  }

  async duplicateEvent(id: string): Promise<IEvent> {
    return this._request(`/api/v2/events/${id}/duplicate`, { method: 'POST' });
  }

  // Event Items
  async addEventItem(eventId: string, data: AnyRecord): Promise<IEventItem> {
    return this._request(`/api/v2/events/${eventId}/items`, { method: 'POST', body: JSON.stringify(data) });
  }

  async updateEventItem(eventId: string, itemId: string, data: AnyRecord): Promise<IEventItem> {
    return this._request(`/api/v2/events/${eventId}/items/${itemId}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteEventItem(eventId: string, itemId: string): Promise<void> {
    await this._request(`/api/v2/events/${eventId}/items/${itemId}`, { method: 'DELETE' });
  }

  // Event Todos
  async addEventTodo(eventId: string, data: AnyRecord): Promise<IEventTodo> {
    return this._request(`/api/v2/events/${eventId}/todos`, { method: 'POST', body: JSON.stringify(data) });
  }

  async updateEventTodo(eventId: string, todoId: string, data: AnyRecord): Promise<IEventTodo> {
    return this._request(`/api/v2/events/${eventId}/todos/${todoId}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async toggleEventTodo(eventId: string, todoId: string): Promise<IEventTodo> {
    return this._request(`/api/v2/events/${eventId}/todos/${todoId}/toggle`, { method: 'POST' });
  }

  async deleteEventTodo(eventId: string, todoId: string): Promise<void> {
    await this._request(`/api/v2/events/${eventId}/todos/${todoId}`, { method: 'DELETE' });
  }

  // Event Notes
  async addEventNote(eventId: string, data: AnyRecord): Promise<IEventNote> {
    return this._request(`/api/v2/events/${eventId}/notes`, { method: 'POST', body: JSON.stringify(data) });
  }

  async updateEventNote(eventId: string, noteId: string, data: AnyRecord): Promise<IEventNote> {
    return this._request(`/api/v2/events/${eventId}/notes/${noteId}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteEventNote(eventId: string, noteId: string): Promise<void> {
    await this._request(`/api/v2/events/${eventId}/notes/${noteId}`, { method: 'DELETE' });
  }

  // Event Expenses
  async addEventExpense(eventId: string, data: AnyRecord): Promise<IEventExpense> {
    return this._request(`/api/v2/events/${eventId}/expenses`, { method: 'POST', body: JSON.stringify(data) });
  }

  async updateEventExpense(eventId: string, expenseId: string, data: AnyRecord): Promise<IEventExpense> {
    return this._request(`/api/v2/events/${eventId}/expenses/${expenseId}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteEventExpense(eventId: string, expenseId: string): Promise<void> {
    await this._request(`/api/v2/events/${eventId}/expenses/${expenseId}`, { method: 'DELETE' });
  }

  // ─── Fixed Expenses ───────────────────────────────
  async getFixedExpenses(): Promise<AnyRecord[]> {
    return this._request('/api/v2/fixed-expenses');
  }

  async createFixedExpense(data: AnyRecord): Promise<AnyRecord> {
    return this._request('/api/v2/fixed-expenses', { method: 'POST', body: JSON.stringify(data) });
  }

  async deleteFixedExpense(id: string): Promise<void> {
    await this._request(`/api/v2/fixed-expenses/${id}`, { method: 'DELETE' });
  }

  // ─── Savings ──────────────────────────────────────
  async getSavingsGoals(): Promise<AnyRecord[]> {
    return this._request('/api/v2/savings/goals');
  }

  async createSavingsGoal(data: AnyRecord): Promise<AnyRecord> {
    return this._request('/api/v2/savings/goals', { method: 'POST', body: JSON.stringify(data) });
  }

  async addDeposit(goalId: string, data: AnyRecord): Promise<AnyRecord> {
    return this._request(`/api/v2/savings/goals/${goalId}/deposits`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ─── Dashboard ────────────────────────────────────
  async getDashboard(): Promise<AnyRecord> {
    return this._request('/api/v2/dashboard');
  }

  async getDashboardSummary(): Promise<{
    balance: number;
    balanceAfterPlanned: number;
    incurredCosts: number;
    plannedCosts: number;
  }> {
    return this._request('/api/v2/dashboard/summary');
  }
}

export const api = new ApiClient(API_URL);
