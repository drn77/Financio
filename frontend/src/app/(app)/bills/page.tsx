'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, LayoutGrid, List } from 'lucide-react';
import type { IBill, IBillPayment } from '@shared/models';
import {
  EMPTY_FORM,
  type IBillFormData,
  type IFilterState,
  type ITagOption,
  type SortField,
  type SortDirection,
} from './model';
import { BillFormDialog } from './BillFormDialog';
import { BillCard } from './BillCard';
import { BillFilters } from './BillFilters';
import { BillSummary } from './BillSummary';
import { PayBillDialog } from './PayBillDialog';
import { PaymentHistoryDialog } from './PaymentHistoryDialog';

type ISelectableExpenseField = {
  id: string;
  name: string;
  type: string;
  tagGroupId?: string | null;
};

type IExpenseTagGroup = {
  tagGroupId: string;
  columnName: string;
  mode: 'available' | 'select' | 'auto_tags';
  autoTagIds: string[];
};

export default function BillsPage() {
  const [bills, setBills] = useState<IBill[]>([]);
  const [tags, setTags] = useState<ITagOption[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<{ id: string; name: string }[]>([]);
  const [savingsTagId, setSavingsTagId] = useState<string | null>(null);
  const [expenseTagGroups, setExpenseTagGroups] = useState<IExpenseTagGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingBill, setEditingBill] = useState<IBill | null>(null);
  const [form, setForm] = useState<IBillFormData>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [payBill, setPayBill] = useState<IBill | null>(null);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [isPaying, setIsPaying] = useState(false);

  const [historyBill, setHistoryBill] = useState<IBill | null>(null);
  const [historyPayments, setHistoryPayments] = useState<IBillPayment[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [filters, setFilters] = useState<IFilterState>({
    status: 'ALL',
    tagIds: [],
    search: '',
  });

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState('active');

  const [sortField, setSortField] = useState<SortField | ''>('');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [deleteTarget, setDeleteTarget] = useState<IBill | null>(null);

  const _refreshLinkedExpenses = useCallback(async () => {
    try {
      await api.syncBillAutoExpenses();
    } catch (error) {
      console.error('Failed to sync linked expenses after bill change', error);
    }
    window.dispatchEvent(new Event('financio:summary-refresh'));
  }, []);

  const _loadData = useCallback(async () => {
    try {
      const [billsData, tagGroupsData, goalsData, tagMappings, expenseMappingsData] = await Promise.all([
        api.getBills(),
        api.getTagGroups(),
        api.getSavingsGoals(),
        api.getTagMappings(),
        api.getExpenseMappings(),
      ]);

      setBills(Array.isArray(billsData) ? billsData : []);

      const flatTags: ITagOption[] = [];

      if (Array.isArray(tagGroupsData)) {
        for (const group of tagGroupsData) {
          if (Array.isArray(group.tags)) {
            for (const tag of group.tags) {
              flatTags.push({
                id: tag.id,
                name: tag.name,
                color: tag.color || '#2ECC71',
                groupName: group.name,
                tagGroupId: group.id,
              });
            }
          }
        }
      }

      setTags(flatTags);
      setSavingsGoals(
        Array.isArray(goalsData)
          ? goalsData.map((goal: { id: string; name: string }) => ({ id: goal.id, name: goal.name }))
          : [],
      );
      setSavingsTagId(tagMappings?.savings ?? null);

      // Extract expense tag groups for recurring-expense status transitions and default auto tags.
      const billFieldConfigs = expenseMappingsData?.mappings?.bills?.fieldConfigs ?? {};
      const availableFields = (expenseMappingsData?.availableFields ?? []) as ISelectableExpenseField[];
      const expenseGroups = new Map<string, IExpenseTagGroup>();
      for (const field of availableFields) {
        if (field.type === 'tag_group' && field.tagGroupId) {
          const config = billFieldConfigs[field.id];
          const current = expenseGroups.get(field.tagGroupId);
          const mode = config?.mode === 'select' || config?.mode === 'auto_tags'
            ? config.mode
            : 'available';
          const autoTagIds = config?.mode === 'auto_tags' ? (config.autoTagIds ?? []) : [];

          if (!current) {
            expenseGroups.set(field.tagGroupId, {
              tagGroupId: field.tagGroupId,
              columnName: field.name,
              mode,
              autoTagIds,
            });
            continue;
          }

          if (mode === 'auto_tags') {
            current.mode = 'auto_tags';
            current.autoTagIds = Array.from(new Set([...current.autoTagIds, ...autoTagIds]));
          } else if (mode === 'select' && current.mode === 'available') {
            current.mode = 'select';
          }

          if (!current.columnName && field.name) {
            current.columnName = field.name;
          }
        }
      }
      setExpenseTagGroups(Array.from(expenseGroups.values()));
    } catch {
      setBills([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    _loadData();
  }, [_loadData]);

  const filteredBills = useMemo(() => {
    let result = bills;

    if (activeTab === 'active') {
      result = result.filter((b) => b.isActive);
    } else if (activeTab === 'inactive') {
      result = result.filter((b) => !b.isActive);
    }

    if (filters.status !== 'ALL') {
      result = result.filter((b) => b.status === filters.status);
    }

    if (filters.tagIds.length > 0) {
      result = result.filter((b) =>
        b.tags.some((t) => filters.tagIds.includes(t.id)),
      );
    }

    if (filters.search) {
      const query = filters.search.toLowerCase();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(query) ||
          b.notes?.toLowerCase().includes(query),
      );
    }

    return result;
  }, [bills, filters, activeTab]);

  const sortedBills = useMemo(() => {
    if (!sortField) return filteredBills;

    const STATUS_ORDER: Record<string, number> = {
      OVERDUE: 0,
      DUE_TODAY: 1,
      UPCOMING: 2,
      PARTIALLY_PAID: 3,
      PAID: 4,
    };

    return [...filteredBills].sort((a, b) => {
      let cmp = 0;

      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name, 'pl');
          break;
        case 'amount':
          cmp = a.amount - b.amount;
          break;
        case 'dueDay':
          cmp = a.dueDay - b.dueDay;
          break;
        case 'status':
          cmp = (STATUS_ORDER[a.status ?? 'UPCOMING'] ?? 99) - (STATUS_ORDER[b.status ?? 'UPCOMING'] ?? 99);
          break;
      }

      return sortDirection === 'desc' ? -cmp : cmp;
    });
  }, [filteredBills, sortField, sortDirection]);

  const _handleOpenCreate = useCallback(() => {
    setEditingBill(null);
    const autoTagIds = expenseTagGroups
      .filter((g) => g.mode === 'auto_tags')
      .flatMap((g) => g.autoTagIds);
    setForm({
      ...EMPTY_FORM,
      paymentStartDate: new Date().toISOString().split('T')[0],
      tagIds: Array.from(new Set(autoTagIds)),
    });
    setShowForm(true);
  }, [expenseTagGroups]);

  const _handleOpenEdit = useCallback((bill: IBill) => {
    setEditingBill(bill);
    setForm({
      name: bill.name,
      amount: String(bill.amount),
      dueDay: String(bill.dueDay),
      paymentStartDate: bill.paymentStartDate ? new Date(bill.paymentStartDate).toISOString().split('T')[0] : '',
      paymentEndDate: bill.paymentEndDate ? new Date(bill.paymentEndDate).toISOString().split('T')[0] : '',
      frequency: bill.frequency,
      notes: bill.notes ?? '',
      paymentType: bill.paymentType,
      autoCreateExpense: bill.autoCreateExpense,
      reminderDays: String(bill.reminderDays),
      budgetLimit: bill.budgetLimit != null ? String(bill.budgetLimit) : '',
      savingsGoalId: bill.savingsGoalId ?? '',
      tagIds: bill.tags.map((t) => t.id),
      tagBeforePaymentId: bill.tagBeforePaymentId ?? '',
      tagAfterPaymentId: bill.tagAfterPaymentId ?? '',
    });
    setShowForm(true);
  }, []);

  const _handleSubmitForm = useCallback(async () => {
    setIsSubmitting(true);

    try {
      const payload = {
        name: form.name,
        amount: Number(form.amount),
        dueDay: Number(form.dueDay),
        paymentStartDate: form.paymentStartDate,
        paymentEndDate: form.paymentEndDate || undefined,
        frequency: form.frequency,
        notes: form.notes || undefined,
        paymentType: form.paymentType,
        autoCreateExpense: form.autoCreateExpense,
        reminderDays: Number(form.reminderDays),
        budgetLimit: form.budgetLimit ? Number(form.budgetLimit) : undefined,
        savingsGoalId: form.savingsGoalId || undefined,
        tagIds: form.tagIds.length > 0 ? form.tagIds : undefined,
        tagBeforePaymentId: form.tagBeforePaymentId || undefined,
        tagAfterPaymentId: form.tagAfterPaymentId || undefined,
      };

      if (editingBill) {
        await api.updateBill(editingBill.id, payload);
      } else {
        await api.createBill(payload);
      }

      await _refreshLinkedExpenses();

      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingBill(null);
      await _loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  }, [form, editingBill, _loadData, _refreshLinkedExpenses]);

  const _handleRequestDelete = useCallback((bill: IBill) => {
    setDeleteTarget(bill);
  }, []);

  const _handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;

    try {
      await api.deleteBill(deleteTarget.id);
      await _loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, _loadData]);

  const _handleToggleActive = useCallback(
    async (bill: IBill) => {
      try {
        await api.updateBill(bill.id, { isActive: !bill.isActive });
        await _refreshLinkedExpenses();
        await _loadData();
      } catch (e) {
        console.error(e);
      }
    },
    [_loadData, _refreshLinkedExpenses],
  );

  const _handleDeletePayment = useCallback(
    async (billId: string, paymentId: string) => {
      try {
        await api.deleteBillPayment(billId, paymentId);
        await _refreshLinkedExpenses();
        await _loadData();

        // Refresh history if still viewing
        if (showHistory && historyBill && historyBill.id === billId) {
          const payments = await api.getBillPayments(billId);
          setHistoryPayments(Array.isArray(payments) ? payments : []);

          const updatedBills = await api.getBills();
          const updated = (Array.isArray(updatedBills) ? updatedBills : []).find(
            (b: IBill) => b.id === billId,
          );
          if (updated) setHistoryBill(updated);
        }
      } catch (e) {
        console.error(e);
      }
    },
    [_loadData, showHistory, historyBill, _refreshLinkedExpenses],
  );

  const _handleOpenPay = useCallback((bill: IBill) => {
    setPayBill(bill);
    setShowPayDialog(true);
  }, []);

  const _handlePaySubmit = useCallback(
    async (billId: string, amount: number, dueDate: string, notes?: string) => {
      setIsPaying(true);

      try {
        await api.payBill(billId, { amount, dueDate, notes });
        await _refreshLinkedExpenses();
        setShowPayDialog(false);
        setPayBill(null);
        await _loadData();

        // Refresh history dialog if it's open for the same bill
        if (showHistory && historyBill && historyBill.id === billId) {
          const payments = await api.getBillPayments(billId);
          setHistoryPayments(Array.isArray(payments) ? payments : []);

          // Refresh the bill object in history to get updated paidAmount/status
          const updatedBills = await api.getBills();
          const updated = (Array.isArray(updatedBills) ? updatedBills : []).find(
            (b: IBill) => b.id === billId,
          );

          if (updated) {
            setHistoryBill(updated);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsPaying(false);
      }
    },
    [_loadData, showHistory, historyBill, _refreshLinkedExpenses],
  );

  const _handleViewHistory = useCallback(async (bill: IBill) => {
    setHistoryBill(bill);
    setShowHistory(true);
    setIsLoadingHistory(true);

    try {
      const payments = await api.getBillPayments(bill.id);
      setHistoryPayments(Array.isArray(payments) ? payments : []);
    } catch {
      setHistoryPayments([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cykliczne wydatki</h1>
          <p className="text-sm text-muted-foreground">
            Zarządzaj cyklicznymi wydatkami i śledź płatności
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-r-none"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-l-none"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button size="sm" onClick={_handleOpenCreate}>
            <Plus className="mr-1 h-4 w-4" /> Dodaj cykliczny wydatek
          </Button>
        </div>
      </div>

      <BillSummary bills={bills} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active">
            Aktywne ({bills.filter((b) => b.isActive).length})
          </TabsTrigger>
          <TabsTrigger value="inactive">
            Nieaktywne ({bills.filter((b) => !b.isActive).length})
          </TabsTrigger>
          <TabsTrigger value="all">
            Wszystkie ({bills.length})
          </TabsTrigger>
        </TabsList>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <BillFilters
            filters={filters}
            onFiltersChange={setFilters}
            tags={tags}
            sortField={sortField}
            sortDirection={sortDirection}
            onSortFieldChange={setSortField}
            onSortDirectionToggle={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
          />
        </div>

        <TabsContent value={activeTab} className="mt-4">
          {sortedBills.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
              <p className="text-muted-foreground">
                {bills.length === 0 ? 'Brak cyklicznych wydatków' : 'Brak cyklicznych wydatków pasujących do filtrów'}
              </p>
              {bills.length === 0 && (
                <Button variant="outline" size="sm" className="mt-3" onClick={_handleOpenCreate}>
                  <Plus className="mr-1 h-4 w-4" />
                  Dodaj pierwszy cykliczny wydatek
                </Button>
              )}
            </div>
          ) : (
            <div
              className={
                viewMode === 'grid'
                  ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'
                  : 'space-y-3'
              }
            >
              {sortedBills.map((bill) => (
                <BillCard
                  key={bill.id}
                  bill={bill}
                  onPay={_handleOpenPay}
                  onEdit={_handleOpenEdit}
                  onDelete={_handleRequestDelete}
                  onViewHistory={_handleViewHistory}
                  onToggleActive={_handleToggleActive}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <BillFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        form={form}
        onFormChange={setForm}
        onSubmit={_handleSubmitForm}
        tags={tags}
        editingBill={editingBill}
        isSubmitting={isSubmitting}
        savingsGoals={savingsGoals}
        savingsTagId={savingsTagId}
        expenseTagGroups={expenseTagGroups}
      />

      <PayBillDialog
        open={showPayDialog}
        onOpenChange={setShowPayDialog}
        bill={payBill}
        onSubmit={_handlePaySubmit}
        isSubmitting={isPaying}
      />

      <PaymentHistoryDialog
        open={showHistory}
        onOpenChange={setShowHistory}
        bill={historyBill}
        payments={historyPayments}
        isLoading={isLoadingHistory}
        onPay={_handleOpenPay}
        onDeletePayment={_handleDeletePayment}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć cykliczny wydatek?</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć &quot;{deleteTarget?.name}&quot;? Tej operacji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={_handleConfirmDelete}
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
