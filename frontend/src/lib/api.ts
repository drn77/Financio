import type { ILoginRequest, IRegisterRequest, IUser, ISessionResponse } from '@shared/auth';
import type { IBill, IBillPayment, IBillStats, IRecordStats, IReceipt, IReceiptStats, IStore, IBudget, IEvent, IEventItem, IEventTodo, IEventNote, IEventExpense, IEventStats } from '@shared/models';
import { toastError, toastSuccess } from './toast';

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

  private _defaultSuccessMessage(method: string, path: string): string {
    const cleanPath = path.split('?')[0];

    if (method === 'POST' && cleanPath === '/api/v2/auth/login') return 'Zalogowano pomyślnie';
    if (method === 'POST' && cleanPath === '/api/v2/auth/register') return 'Konto zostało utworzone';
    if (method === 'POST' && cleanPath === '/api/v2/auth/logout') return 'Wylogowano pomyślnie';

    if (method === 'PUT' && cleanPath === '/api/v2/tax/config') return 'Zapisano konfigurację podatków';
    if (method === 'PUT' && cleanPath === '/api/v2/family/tag-mappings') return 'Zapisano mapowanie tagów';
    if (method === 'PUT' && cleanPath === '/api/v2/kanban/config') return 'Zapisano konfigurację Kanban';
    if (method === 'PUT' && cleanPath === '/api/v2/dashboard/config') return 'Zapisano konfigurację dashboardu';
    if (method === 'POST' && cleanPath === '/api/v2/kanban/move') return 'Przeniesiono kartę';

    if (method === 'POST' && /\/api\/v2\/bills\/[^/]+\/pay$/.test(cleanPath)) return 'Oznaczono rachunek jako opłacony';
    if (method === 'POST' && /\/api\/v2\/fixed-expenses\/[^/]+\/pay$/.test(cleanPath)) return 'Opłacono stały wydatek';
    if (method === 'POST' && /\/api\/v2\/receipts\/[^/]+\/create-expense$/.test(cleanPath)) return 'Zatwierdzono paragon i dodano wydatek';
    if (method === 'POST' && /\/api\/v2\/templates\/[^/]+\/records\/import$/.test(cleanPath)) return 'Zaimportowano rekordy';
    if (method === 'PUT' && /\/api\/v2\/templates\/[^/]+\/records\/bulk$/.test(cleanPath)) return 'Zapisano zmiany rekordów';
    if (method === 'POST' && /\/api\/v2\/templates\/[^/]+\/records\/[^/]+\/duplicate$/.test(cleanPath)) return 'Zduplikowano rekord';
    if (method === 'POST' && /\/api\/v2\/receipts\/[^/]+\/duplicate$/.test(cleanPath)) return 'Zduplikowano paragon';

    if (method === 'PUT' && /\/api\/v2\/tag-groups\/[^/]+\/tags\/reorder$/.test(cleanPath)) return 'Zmieniono kolejność tagów';

    if (method === 'POST') return 'Dodano pomyślnie';
    if (method === 'PUT' || method === 'PATCH') return 'Zapisano zmiany';
    if (method === 'DELETE') return 'Usunięto pomyślnie';
    return 'Operacja zakończona powodzeniem';
  }

  private async _request<T>(
    path: string,
    options: RequestInit & {
      timeout?: number;
      notifySuccess?: boolean;
      successMessage?: string;
      suppressErrorToast?: boolean;
    } = {}
  ): Promise<T> {
    const {
      timeout = 15000,
      notifySuccess,
      successMessage,
      suppressErrorToast = false,
      ...fetchOptions
    } = options;

    const controller = new AbortController();
    const timeoutId = timeout > 0 ? setTimeout(() => controller.abort(), timeout) : null;

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...fetchOptions,
        credentials: 'include',
        signal: controller.signal,
        headers: {
          ...this._getHeaders(),
          ...fetchOptions.headers,
        },
      });

      const method = (fetchOptions.method ?? 'GET').toUpperCase();
      const isMutation = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';

      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        const message = (responseData as { message?: string } | null)?.message || `HTTP ${response.status}`;
        const requestError = new Error(message) as Error & { _toastShown?: boolean };
        if (!suppressErrorToast) {
          toastError(message);
          requestError._toastShown = true;
        }
        throw requestError;
      }

      if ((notifySuccess ?? isMutation) && typeof window !== 'undefined') {
        const messageFromResponse = (responseData as { message?: string } | null)?.message;
        toastSuccess(
          successMessage ||
          this._defaultSuccessMessage(method, path) ||
          messageFromResponse ||
          'Operacja zakończona powodzeniem'
        );
      }

      return responseData as T;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        const message = 'Przekroczono limit czasu połączenia z serwerem';
        const timeoutError = new Error(message) as Error & { _toastShown?: boolean };
        if (!suppressErrorToast) {
          toastError(message);
          timeoutError._toastShown = true;
        }
        throw timeoutError;
      }

      if (!suppressErrorToast && error instanceof Error && !(error as Error & { _toastShown?: boolean })._toastShown && error.message) {
        if (error.message !== 'Request failed') {
          toastError(error.message);
        }
      }

      throw error;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
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

  async getTagMappings(): Promise<Record<string, string>> {
    return this._request('/api/v2/family/tag-mappings');
  }

  async updateTagMappings(mappings: { income?: string; expense?: string; planning?: string; costs?: string }): Promise<Record<string, string>> {
    return this._request('/api/v2/family/tag-mappings', { method: 'PUT', body: JSON.stringify(mappings) });
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

  async createReceipt(data: AnyRecord, options?: { notifySuccess?: boolean; suppressErrorToast?: boolean }): Promise<IReceipt> {
    return this._request('/api/v2/receipts', {
      method: 'POST',
      body: JSON.stringify(data),
      notifySuccess: options?.notifySuccess,
      suppressErrorToast: options?.suppressErrorToast,
    });
  }

  async updateReceipt(id: string, data: AnyRecord, options?: { notifySuccess?: boolean; suppressErrorToast?: boolean }): Promise<IReceipt> {
    return this._request(`/api/v2/receipts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      notifySuccess: options?.notifySuccess,
      suppressErrorToast: options?.suppressErrorToast,
    });
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

  async getFixedExpense(id: string): Promise<AnyRecord> {
    return this._request(`/api/v2/fixed-expenses/${id}`);
  }

  async createFixedExpense(data: AnyRecord): Promise<AnyRecord> {
    return this._request('/api/v2/fixed-expenses', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateFixedExpense(id: string, data: AnyRecord): Promise<AnyRecord> {
    return this._request(`/api/v2/fixed-expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async payFixedExpense(id: string, data?: AnyRecord): Promise<AnyRecord> {
    return this._request(`/api/v2/fixed-expenses/${id}/pay`, { method: 'POST', body: JSON.stringify(data ?? {}) });
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

  async updateSavingsGoal(id: string, data: AnyRecord): Promise<AnyRecord> {
    return this._request(`/api/v2/savings/goals/${id}`, { method: 'PUT', body: JSON.stringify(data) });
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
    pendingReceiptOcrCount: number;
    upcomingPlannedPayments: Array<{
      id: string;
      source: 'bill' | 'fixed-expense' | 'savings';
      name: string;
      amount: number;
      currency: string;
      dueDate: string;
    }>;
  }> {
    return this._request('/api/v2/dashboard/summary');
  }

  async getDashboardConfig(): Promise<{
    categoryFieldId: string | null;
    availableCategoryFields: Array<{
      id: string;
      name: string;
      tagGroupId: string | null;
      tagGroupName: string | null;
    }>;
  }> {
    return this._request('/api/v2/dashboard/config');
  }

  async updateDashboardConfig(data: { categoryFieldId?: string | null }): Promise<{
    categoryFieldId: string | null;
    availableCategoryFields: Array<{
      id: string;
      name: string;
      tagGroupId: string | null;
      tagGroupName: string | null;
    }>;
  }> {
    return this._request('/api/v2/dashboard/config', { method: 'PUT', body: JSON.stringify(data) });
  }

  // ─── Taxes ───────────────────────────────────────
  async getTaxConfig(): Promise<{
    form: 'SCALE' | 'LINEAR' | 'LUMPSUM';
    lumpSumRate: number;
    includeSickness: boolean;
    includeSocialContributions: boolean;
    includeHealthContribution: boolean;
  }> {
    return this._request('/api/v2/tax/config');
  }

  async updateTaxConfig(data: AnyRecord): Promise<AnyRecord> {
    return this._request('/api/v2/tax/config', { method: 'PUT', body: JSON.stringify(data) });
  }

  async getTaxSummary(month?: number, year?: number): Promise<AnyRecord> {
    const params = new URLSearchParams();
    if (month) params.set('month', String(month));
    if (year) params.set('year', String(year));
    const qs = params.toString();
    return this._request(`/api/v2/tax/summary${qs ? `?${qs}` : ''}`);
  }

  // ─── Kanban ───────────────────────────────────────
  async getKanbanConfig(): Promise<{
    columns: Array<{
      id: string;
      name: string;
      tagId: string;
      objectTypes: Array<'bill' | 'expense' | 'fixed-expense' | 'receipt'>;
    }>;
  }> {
    return this._request('/api/v2/kanban/config');
  }

  async updateKanbanConfig(data: AnyRecord): Promise<AnyRecord> {
    return this._request('/api/v2/kanban/config', { method: 'PUT', body: JSON.stringify(data) });
  }

  async getKanbanBoard(): Promise<{
    columns: Array<{
      id: string;
      name: string;
      tagId: string;
      tagName?: string | null;
      objectTypes: Array<'bill' | 'expense' | 'fixed-expense' | 'receipt'>;
      cards: Array<{
        id: string;
        objectType: 'bill' | 'expense' | 'fixed-expense' | 'receipt';
        objectId: string;
        title: string;
        amount: number;
        currency: string;
        meta?: string;
        cardBgColor?: string;
        amountBgColor?: string;
      }>;
    }>;
  }> {
    return this._request('/api/v2/kanban/board');
  }

  async moveKanbanCard(data: {
    objectType: 'bill' | 'expense' | 'fixed-expense' | 'receipt';
    objectId: string;
    fromTagId?: string;
    toTagId: string;
  }): Promise<{ message: string }> {
    return this._request('/api/v2/kanban/move', { method: 'POST', body: JSON.stringify(data) });
  }

  async getKanbanCard(objectType: 'bill' | 'expense' | 'fixed-expense' | 'receipt', objectId: string): Promise<AnyRecord> {
    const params = new URLSearchParams({ objectType, objectId });
    return this._request(`/api/v2/kanban/card?${params.toString()}`);
  }

  async updateKanbanCard(data: {
    objectType: 'bill' | 'expense' | 'fixed-expense' | 'receipt';
    objectId: string;
    patch: Record<string, unknown>;
  }): Promise<{ message: string }> {
    return this._request('/api/v2/kanban/card', { method: 'PUT', body: JSON.stringify(data) });
  }
}

export const api = new ApiClient(API_URL);
