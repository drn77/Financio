'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  Download,
  Building2,
  FileText,
  Send,
  X,
  Copy,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  RefreshCw,
  Mail,
  History,
  FileWarning,
  FileDown,
  Play,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ──────── Types ────────

interface ICompany {
  id: string;
  name: string;
  nip?: string;
  regon?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country: string;
  email?: string;
  phone?: string;
  bankName?: string;
  bankAccount?: string;
  isOwn: boolean;
}

interface IInvoiceItem {
  id?: string;
  sortOrder: number;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  vatRate: string;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
}

interface IInvoice {
  id: string;
  number: string;
  type: string;
  status: string;
  issueDate: string;
  saleDate: string;
  dueDate: string;
  sellerId: string;
  buyerId: string;
  seller: ICompany;
  buyer: ICompany;
  paymentMethod: string;
  bankAccount?: string;
  currency: string;
  totalNet: number;
  totalVat: number;
  totalGross: number;
  isPaid: boolean;
  paidAt?: string;
  paidAmount?: number;
  notes?: string;
  title?: string;
  issuePlace?: string;
  items: IInvoiceItem[];
  correctedInvoiceId?: string;
  corrections?: { id: string; number: string }[];
}

interface IInvoiceStats {
  year: number;
  totalInvoices: number;
  totalNet: number;
  totalGross: number;
  paidNet: number;
  paidGross: number;
  unpaidGross: number;
  overdueCount: number;
}

const INVOICE_TYPES: Record<string, string> = {
  STANDARD: 'Faktura VAT',
  VAT_EXEMPT: 'Faktura bez VAT',
  PROFORMA: 'Proforma',
  CORRECTION: 'Korygująca',
  ADVANCE: 'Zaliczkowa',
};

const INVOICE_STATUSES: Record<string, string> = {
  DRAFT: 'Szkic',
  ISSUED: 'Wystawiona',
  SENT: 'Wysłana',
  PAID: 'Opłacona',
  OVERDUE: 'Po terminie',
  CANCELLED: 'Anulowana',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  ISSUED: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  SENT: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  PAID: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  OVERDUE: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  CANCELLED: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
};

const VAT_RATES = ['23', '8', '5', '0', 'zw', 'np'];
const UNITS = ['usł.', 'szt.', 'godz.', 'komplet', 'km', 'kg', 'm²', 'm³'];
const PAYMENT_METHODS: Record<string, string> = {
  przelew: 'Przelew bankowy',
  gotowka: 'Gotówka',
  karta: 'Karta płatnicza',
  paypal: 'PayPal',
  inne: 'Inne',
};

const FREQUENCY_LABELS: Record<string, string> = {
  DAILY: 'Codziennie',
  WEEKLY: 'Co tydzień',
  MONTHLY: 'Co miesiąc',
  QUARTERLY: 'Co kwartał',
  YEARLY: 'Co rok',
};

const CHART_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'];

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(v);

const fmtDate = (d: string) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('pl-PL');
};

const today = () => new Date().toISOString().split('T')[0];

// ──────── Main Page ────────

export default function InvoicesPage() {
  const [activeTab, setActiveTab] = useState('invoices');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Przychody</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="invoices">
            <FileText className="h-4 w-4 mr-1" /> Faktury
          </TabsTrigger>
          <TabsTrigger value="recurring">
            <RefreshCw className="h-4 w-4 mr-1" /> Cykliczne
          </TabsTrigger>
          <TabsTrigger value="companies">
            <Building2 className="h-4 w-4 mr-1" /> Kontrahenci
          </TabsTrigger>
          <TabsTrigger value="own">
            <Building2 className="h-4 w-4 mr-1" /> Moja firma
          </TabsTrigger>
          <TabsTrigger value="charts">
            <BarChart3 className="h-4 w-4 mr-1" /> Wykresy
          </TabsTrigger>
          <TabsTrigger value="stats">
            <BarChart3 className="h-4 w-4 mr-1" /> Statystyki
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices"><InvoicesTab /></TabsContent>
        <TabsContent value="recurring"><RecurringTab /></TabsContent>
        <TabsContent value="companies"><CompaniesTab /></TabsContent>
        <TabsContent value="own"><OwnCompanyTab /></TabsContent>
        <TabsContent value="charts"><ChartsTab /></TabsContent>
        <TabsContent value="stats"><StatsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ──────── Invoices Tab ────────

function InvoicesTab() {
  const [invoices, setInvoices] = useState<IInvoice[]>([]);
  const [companies, setCompanies] = useState<ICompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<IInvoice | null>(null);
  const [showAuditDialog, setShowAuditDialog] = useState(false);
  const [auditInvoiceId, setAuditInvoiceId] = useState('');
  const [auditInvoiceNumber, setAuditInvoiceNumber] = useState('');
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailInvoice, setEmailInvoice] = useState<IInvoice | null>(null);
  const [viewMonth, setViewMonth] = useState(new Date().getMonth() + 1);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());

  const loadData = useCallback(async () => {
    try {
      const [inv, comp] = await Promise.all([
        api.getInvoices({ month: viewMonth, year: viewYear }),
        api.getCompanies(),
      ]);
      setInvoices(inv as IInvoice[]);
      setCompanies(comp as ICompany[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [viewMonth, viewYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePrevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const handleNextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteInvoice(id);
      loadData();
    } catch (e) { console.error(e); }
  };

  const handleIssue = async (id: string) => {
    try {
      await api.issueInvoice(id);
      loadData();
    } catch (e) { console.error(e); }
  };

  const handlePay = async (id: string) => {
    try {
      await api.markInvoicePaid(id);
      loadData();
    } catch (e) { console.error(e); }
  };

  const handleDuplicate = async (invoice: IInvoice) => {
    try {
      await api.createInvoice({
        type: invoice.type,
        sellerId: invoice.sellerId,
        buyerId: invoice.buyerId,
        issueDate: today(),
        saleDate: today(),
        dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        paymentMethod: invoice.paymentMethod,
        bankAccount: invoice.bankAccount,
        currency: invoice.currency,
        notes: invoice.notes,
        items: invoice.items.map((i, idx) => ({
          sortOrder: idx,
          description: i.description,
          unit: i.unit,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          vatRate: i.vatRate,
        })),
      });
      loadData();
    } catch (e) { console.error(e); }
  };

  const handleSendEmail = (invoice: IInvoice) => {
    setEmailInvoice(invoice);
    setShowEmailDialog(true);
  };

  const handleCorrect = async (id: string) => {
    if (!confirm('Czy na pewno chcesz utworzyć fakturę korygującą?')) return;
    try {
      await api.createCorrectionInvoice(id);
      loadData();
    } catch (e) { console.error(e); }
  };

  const handleCheckOverdue = async () => {
    try {
      const result = await api.checkOverdueInvoices();
      if ((result as any).updated > 0) loadData();
    } catch (e) { console.error(e); }
  };

  const monthLabel = new Date(viewYear, viewMonth - 1).toLocaleDateString('pl-PL', { year: 'numeric', month: 'long' });

  if (loading) return <div className="flex justify-center py-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-lg font-semibold capitalize min-w-[180px] text-center">{monthLabel}</span>
          <Button variant="outline" size="icon" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleCheckOverdue} title="Sprawdź zaległości">
            <FileWarning className="h-4 w-4 mr-1" /> Zaległości
          </Button>
          <Button onClick={() => { setEditingInvoice(null); setShowCreateDialog(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nowa faktura
          </Button>
        </div>
      </div>

      {/* Invoice list */}
      {invoices.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Brak faktur w tym miesiącu. Kliknij &quot;Nowa faktura&quot; aby wystawić pierwszą fakturę.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {invoices.map(inv => (
            <Card key={inv.id}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{inv.number}</span>
                      <Badge variant="outline" className={STATUS_COLORS[inv.status] ?? ''}>
                        {INVOICE_STATUSES[inv.status] ?? inv.status}
                      </Badge>
                      <Badge variant="secondary">{INVOICE_TYPES[inv.type] ?? inv.type}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {inv.buyer?.name} &bull; {fmtDate(inv.issueDate)} &bull; Termin: {fmtDate(inv.dueDate)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <div className="text-right mr-2">
                      <div className="font-semibold">{fmtCurrency(Number(inv.totalGross))}</div>
                      <div className="text-xs text-muted-foreground">netto: {fmtCurrency(Number(inv.totalNet))}</div>
                    </div>

                    {inv.status === 'DRAFT' && (
                      <Button variant="outline" size="sm" onClick={() => handleIssue(inv.id)} title="Wystaw">
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {!inv.isPaid && inv.status !== 'DRAFT' && inv.status !== 'CANCELLED' && (
                      <Button variant="outline" size="sm" onClick={() => handlePay(inv.id)} title="Opłacono" className="text-green-600">
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    <Button variant="ghost" size="sm" onClick={() => handleDuplicate(inv)} title="Duplikuj">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>

                    {inv.status !== 'DRAFT' && inv.status !== 'CANCELLED' && (
                      <Button variant="ghost" size="sm" onClick={() => handleSendEmail(inv)} title="Wyślij e-mail">
                        <Mail className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {inv.status !== 'DRAFT' && inv.type !== 'CORRECTION' && inv.type !== 'PROFORMA' && (
                      <Button variant="ghost" size="sm" onClick={() => handleCorrect(inv.id)} title="Utwórz korektę">
                        <FileWarning className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    <Button variant="ghost" size="sm" onClick={() => { setAuditInvoiceId(inv.id); setAuditInvoiceNumber(inv.number); setShowAuditDialog(true); }} title="Historia zmian">
                      <History className="h-3.5 w-3.5" />
                    </Button>

                    <Button variant="ghost" size="sm" onClick={() => { setEditingInvoice(inv); setShowCreateDialog(true); }} title="Edytuj">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>

                    <Button variant="ghost" size="sm" onClick={() => generatePdf(inv)} title="Pobierz PDF">
                      <Download className="h-3.5 w-3.5" />
                    </Button>

                    {!inv.isPaid && (
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(inv.id)} title="Usuń" className="text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <InvoiceDialog
        open={showCreateDialog}
        onClose={() => { setShowCreateDialog(false); setEditingInvoice(null); }}
        onSaved={loadData}
        editInvoice={editingInvoice}
        companies={companies}
      />

      {/* Audit History Dialog */}
      <AuditLogDialog
        open={showAuditDialog}
        onClose={() => setShowAuditDialog(false)}
        invoiceId={auditInvoiceId}
        invoiceNumber={auditInvoiceNumber}
      />

      {/* Email Dialog */}
      <SendEmailDialog
        open={showEmailDialog}
        onClose={() => { setShowEmailDialog(false); setEmailInvoice(null); }}
        invoice={emailInvoice}
        onSent={loadData}
      />
    </div>
  );
}

// ──────── Invoice Create/Edit Dialog ────────

function InvoiceDialog({
  open, onClose, onSaved, editInvoice, companies,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editInvoice: IInvoice | null;
  companies: ICompany[];
}) {
  const isEdit = !!editInvoice;
  const sellers = companies.filter(c => c.isOwn);
  const buyers = companies.filter(c => !c.isOwn);

  const [type, setType] = useState('STANDARD');
  const [sellerId, setSellerId] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [issueDate, setIssueDate] = useState(today());
  const [saleDate, setSaleDate] = useState(today());
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('przelew');
  const [bankAccount, setBankAccount] = useState('');
  const [notes, setNotes] = useState('');
  const [title, setTitle] = useState('');
  const [issuePlace, setIssuePlace] = useState('');
  const [items, setItems] = useState<{ description: string; unit: string; quantity: string; unitPrice: string; vatRate: string }[]>([
    { description: '', unit: 'usł.', quantity: '1', unitPrice: '', vatRate: '23' },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editInvoice) {
      setType(editInvoice.type);
      setSellerId(editInvoice.sellerId);
      setBuyerId(editInvoice.buyerId);
      setIssueDate(editInvoice.issueDate?.split('T')[0] ?? today());
      setSaleDate(editInvoice.saleDate?.split('T')[0] ?? today());
      setDueDate(editInvoice.dueDate?.split('T')[0] ?? today());
      setPaymentMethod(editInvoice.paymentMethod);
      setBankAccount(editInvoice.bankAccount ?? '');
      setNotes(editInvoice.notes ?? '');
      setTitle(editInvoice.title ?? '');
      setIssuePlace(editInvoice.issuePlace ?? '');
      setItems(editInvoice.items.map(i => ({
        description: i.description,
        unit: i.unit,
        quantity: String(Number(i.quantity)),
        unitPrice: String(Number(i.unitPrice)),
        vatRate: i.vatRate,
      })));
    } else {
      setType('STANDARD');
      setSellerId(sellers[0]?.id ?? '');
      setBuyerId('');
      setIssueDate(today());
      setSaleDate(today());
      setDueDate(new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]);
      setPaymentMethod('przelew');
      setBankAccount(sellers[0]?.bankAccount ?? '');
      setNotes('');
      setTitle('');
      setIssuePlace('');
      setItems([{ description: '', unit: 'usł.', quantity: '1', unitPrice: '', vatRate: '23' }]);
    }
  }, [editInvoice, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const addItem = () => {
    const defaultVat = type === 'VAT_EXEMPT' ? 'zw' : '23';
    setItems(prev => [...prev, { description: '', unit: 'usł.', quantity: '1', unitPrice: '', vatRate: defaultVat }]);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: string) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const calcItemNet = (item: typeof items[0]) => {
    const q = parseFloat(item.quantity) || 0;
    const p = parseFloat(item.unitPrice) || 0;
    return Math.round(q * p * 100) / 100;
  };

  const calcItemVat = (item: typeof items[0]) => {
    const net = calcItemNet(item);
    if (item.vatRate === 'zw' || item.vatRate === 'np') return 0;
    const rate = parseFloat(item.vatRate) || 0;
    return Math.round(net * rate / 100 * 100) / 100;
  };

  const totalNet = items.reduce((s, i) => s + calcItemNet(i), 0);
  const totalVat = items.reduce((s, i) => s + calcItemVat(i), 0);
  const totalGross = Math.round((totalNet + totalVat) * 100) / 100;

  const handleSave = async () => {
    if (!sellerId || !buyerId || items.length === 0) return;

    setSaving(true);
    try {
      const payload = {
        type,
        sellerId,
        buyerId,
        issueDate,
        saleDate,
        dueDate,
        paymentMethod,
        bankAccount: bankAccount || undefined,
        notes: notes || undefined,
        title: title || undefined,
        issuePlace: issuePlace || undefined,
        items: items.map((item, i) => ({
          sortOrder: i,
          description: item.description,
          unit: item.unit,
          quantity: parseFloat(item.quantity) || 0,
          unitPrice: parseFloat(item.unitPrice) || 0,
          vatRate: item.vatRate,
        })),
      };

      if (isEdit) {
        await api.updateInvoice(editInvoice!.id, payload);
      } else {
        await api.createInvoice(payload);
      }

      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // When seller changes, update bank account
  useEffect(() => {
    if (sellerId && !isEdit) {
      const seller = companies.find(c => c.id === sellerId);
      if (seller?.bankAccount) setBankAccount(seller.bankAccount);
    }
  }, [sellerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // When type changes to VAT_EXEMPT, force all items to 'zw'
  useEffect(() => {
    if (type === 'VAT_EXEMPT') {
      setItems(prev => prev.map(item => ({ ...item, vatRate: 'zw' })));
    }
  }, [type]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edytuj fakturę' : 'Nowa faktura'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Zmień dane faktury' : 'Wypełnij dane faktury i pozycje'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Row 1: Type, dates */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label>Typ faktury</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(INVOICE_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data wystawienia</Label>
              <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
            </div>
            <div>
              <Label>Data sprzedaży</Label>
              <Input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
            </div>
            <div>
              <Label>Termin płatności</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          {/* Row 1b: Title, Place of issue */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Tytuł faktury</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="np. Faktura za usługi programistyczne" />
            </div>
            <div>
              <Label>Miejsce wystawienia</Label>
              <Input value={issuePlace} onChange={e => setIssuePlace(e.target.value)} placeholder="np. Warszawa" />
            </div>
          </div>

          {type === 'VAT_EXEMPT' && (
            <div className="rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-3 text-sm text-blue-800 dark:text-blue-200">
              <strong>Faktura bez VAT</strong> — Wszystkie pozycje będą miały stawkę VAT &quot;zwolniony&quot;.
              Na fakturze zostanie umieszczona informacja o podstawie prawnej zwolnienia (art. 113 ust. 1 i 9 ustawy o VAT).
            </div>
          )}

          {/* Row 2: Seller, Buyer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Sprzedawca</Label>
              <Select value={sellerId} onValueChange={setSellerId}>
                <SelectTrigger><SelectValue placeholder="Wybierz firmę" /></SelectTrigger>
                <SelectContent>
                  {sellers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sellers.length === 0 && (
                <p className="text-xs text-destructive mt-1">Najpierw dodaj swoją firmę w zakładce &quot;Moja firma&quot;</p>
              )}
            </div>
            <div>
              <Label>Nabywca</Label>
              <Select value={buyerId} onValueChange={setBuyerId}>
                <SelectTrigger><SelectValue placeholder="Wybierz kontrahenta" /></SelectTrigger>
                <SelectContent>
                  {buyers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}{c.nip ? ` (NIP: ${c.nip})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {buyers.length === 0 && (
                <p className="text-xs text-destructive mt-1">Najpierw dodaj kontrahenta w zakładce &quot;Kontrahenci&quot;</p>
              )}
            </div>
          </div>

          {/* Row 3: Payment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Sposób płatności</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nr konta bankowego</Label>
              <Input value={bankAccount} onChange={e => setBankAccount(e.target.value)} placeholder="PL XX XXXX XXXX XXXX XXXX XXXX XXXX" />
            </div>
          </div>

          <Separator />

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-semibold">Pozycje faktury</Label>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Dodaj pozycję
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Pozycja {idx + 1}</span>
                    {items.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeItem(idx)} className="text-destructive h-7">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                    <div className="md:col-span-2">
                      <Label className="text-xs">Opis usługi/towaru</Label>
                      <Input
                        value={item.description}
                        onChange={e => updateItem(idx, 'description', e.target.value)}
                        placeholder="np. Usługi programistyczne"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Jednostka</Label>
                      <Select value={item.unit} onValueChange={v => updateItem(idx, 'unit', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Ilość</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.quantity}
                        onChange={e => updateItem(idx, 'quantity', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Cena netto</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unitPrice}
                        onChange={e => updateItem(idx, 'unitPrice', e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Stawka VAT</Label>
                      <Select value={item.vatRate} onValueChange={v => updateItem(idx, 'vatRate', v)} disabled={type === 'VAT_EXEMPT'}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {VAT_RATES.map(r => (
                            <SelectItem key={r} value={r}>
                              {r === 'zw' ? 'zwolniony' : r === 'np' ? 'nie podlega' : `${r}%`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-4 text-sm text-muted-foreground">
                    <span>Netto: <strong className="text-foreground">{fmtCurrency(calcItemNet(item))}</strong></span>
                    <span>VAT: <strong className="text-foreground">{fmtCurrency(calcItemVat(item))}</strong></span>
                    <span>Brutto: <strong className="text-foreground">{fmtCurrency(calcItemNet(item) + calcItemVat(item))}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Totals */}
          <div className="flex justify-end">
            <div className="space-y-1 text-right">
              <div className="text-sm">Razem netto: <strong>{fmtCurrency(totalNet)}</strong></div>
              <div className="text-sm">Razem VAT: <strong>{fmtCurrency(totalVat)}</strong></div>
              <div className="text-lg font-bold">Do zapłaty: {fmtCurrency(totalGross)}</div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Uwagi</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcjonalne notatki na fakturze" rows={2} />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Anuluj</Button>
            <Button onClick={handleSave} disabled={saving || !sellerId || !buyerId || items.length === 0}>
              {saving ? 'Zapisywanie...' : isEdit ? 'Zapisz zmiany' : 'Utwórz fakturę'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ──────── Companies Tab ────────

function CompaniesTab() {
  const [companies, setCompanies] = useState<ICompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editCompany, setEditCompany] = useState<ICompany | null>(null);

  const loadCompanies = useCallback(async () => {
    try {
      const data = await api.getCompanies();
      setCompanies((data as ICompany[]).filter(c => !c.isOwn));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  const handleDelete = async (id: string) => {
    try {
      await api.deleteCompany(id);
      loadCompanies();
    } catch (e) { console.error(e); }
  };

  if (loading) return <div className="flex justify-center py-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Zarządzaj kontrahentami, których możesz używać do wystawiania faktur.</p>
        <Button onClick={() => { setEditCompany(null); setShowDialog(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Dodaj kontrahenta
        </Button>
      </div>

      {companies.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Brak kontrahentów. Dodaj pierwszego kontrahenta, aby móc wystawiać faktury.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {companies.map(c => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{c.name}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditCompany(c); setShowDialog(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                {c.nip && <div><span className="text-muted-foreground">NIP:</span> {c.nip}</div>}
                {c.address && <div><span className="text-muted-foreground">Adres:</span> {c.address}</div>}
                {c.city && <div>{c.postalCode} {c.city}</div>}
                {c.email && <div><span className="text-muted-foreground">Email:</span> {c.email}</div>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CompanyDialog
        open={showDialog}
        onClose={() => { setShowDialog(false); setEditCompany(null); }}
        onSaved={loadCompanies}
        editCompany={editCompany}
        isOwn={false}
      />
    </div>
  );
}

// ──────── Own Company Tab ────────

function OwnCompanyTab() {
  const [company, setCompany] = useState<ICompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);

  const loadOwn = useCallback(async () => {
    try {
      const data = await api.getOwnCompany();
      setCompany(data as ICompany | null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadOwn(); }, [loadOwn]);

  if (loading) return <div className="flex justify-center py-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Dane Twojej firmy będą automatycznie uzupełniane jako sprzedawca na fakturach.</p>

      {company ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {company.name}
              </span>
              <Button variant="outline" size="sm" onClick={() => setShowDialog(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> Edytuj
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <h4 className="font-semibold text-muted-foreground">Dane rejestrowe</h4>
                {company.nip && <div>NIP: <strong>{company.nip}</strong></div>}
                {company.regon && <div>REGON: <strong>{company.regon}</strong></div>}
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-muted-foreground">Adres</h4>
                {company.address && <div>{company.address}</div>}
                {company.city && <div>{company.postalCode} {company.city}</div>}
                <div>{company.country}</div>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-muted-foreground">Kontakt</h4>
                {company.email && <div>Email: {company.email}</div>}
                {company.phone && <div>Tel: {company.phone}</div>}
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-muted-foreground">Dane bankowe</h4>
                {company.bankName && <div>{company.bankName}</div>}
                {company.bankAccount && <div className="font-mono text-xs">{company.bankAccount}</div>}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">Nie skonfigurowano jeszcze danych firmy.</p>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="h-4 w-4 mr-1" /> Dodaj dane firmy
            </Button>
          </CardContent>
        </Card>
      )}

      <CompanyDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        onSaved={loadOwn}
        editCompany={company}
        isOwn={true}
      />
    </div>
  );
}

// ──────── Recurring Invoices Tab ────────

interface IRecurringInvoice {
  id: string;
  name: string;
  isActive: boolean;
  frequency: string;
  nextIssueDate: string;
  lastIssuedAt?: string;
  type: string;
  seller: ICompany;
  buyer: ICompany;
  sellerId: string;
  buyerId: string;
  paymentMethod: string;
  bankAccount?: string;
  currency: string;
  dueDays: number;
  notes?: string;
  autoIssue: boolean;
  autoSend: boolean;
  itemsTemplate: { description: string; unit: string; quantity: number; unitPrice: number; vatRate: string }[];
}

function RecurringTab() {
  const [recurring, setRecurring] = useState<IRecurringInvoice[]>([]);
  const [companies, setCompanies] = useState<ICompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<IRecurringInvoice | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [rec, comp] = await Promise.all([
        api.getRecurringInvoices(),
        api.getCompanies(),
      ]);
      setRecurring(rec as IRecurringInvoice[]);
      setCompanies(comp as ICompany[]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDelete = async (id: string) => {
    if (!confirm('Usunąć szablon?')) return;
    try { await api.deleteRecurringInvoice(id); loadData(); } catch (e) { console.error(e); }
  };

  const handleGenerate = async (id: string) => {
    try { await api.generateFromRecurring(id); loadData(); } catch (e) { console.error(e); }
  };

  const handleToggleActive = async (rec: IRecurringInvoice) => {
    try { await api.updateRecurringInvoice(rec.id, { isActive: !rec.isActive }); loadData(); } catch (e) { console.error(e); }
  };

  if (loading) return <div className="flex justify-center py-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Szablony faktur cyklicznych z automatycznym wystawianiem.</p>
        <Button onClick={() => { setEditing(null); setShowDialog(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nowy szablon
        </Button>
      </div>

      {recurring.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Brak szablonów cyklicznych. Kliknij &quot;Nowy szablon&quot; aby utworzyć pierwszy.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {recurring.map(rec => (
            <Card key={rec.id} className={!rec.isActive ? 'opacity-50' : ''}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{rec.name}</span>
                      <Badge variant={rec.isActive ? 'default' : 'secondary'}>
                        {rec.isActive ? 'Aktywny' : 'Nieaktywny'}
                      </Badge>
                      <Badge variant="outline">{FREQUENCY_LABELS[rec.frequency] ?? rec.frequency}</Badge>
                      <Badge variant="secondary">{INVOICE_TYPES[rec.type] ?? rec.type}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {rec.buyer?.name} &bull; Następna: {fmtDate(rec.nextIssueDate)}
                      {rec.lastIssuedAt && ` • Ostatnia: ${fmtDate(rec.lastIssuedAt)}`}
                      {rec.autoIssue && ' • Auto-wystawienie'}
                      {rec.autoSend && ' • Auto-wysyłka'}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 ml-4">
                    <Button variant="outline" size="sm" onClick={() => handleGenerate(rec.id)} title="Wygeneruj teraz">
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleToggleActive(rec)} title={rec.isActive ? 'Dezaktywuj' : 'Aktywuj'}>
                      {rec.isActive ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(rec); setShowDialog(true); }} title="Edytuj">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(rec.id)} className="text-destructive" title="Usuń">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RecurringDialog
        open={showDialog}
        onClose={() => { setShowDialog(false); setEditing(null); }}
        onSaved={loadData}
        editRecurring={editing}
        companies={companies}
      />
    </div>
  );
}

// ──────── Recurring Invoice Dialog ────────

function RecurringDialog({
  open, onClose, onSaved, editRecurring, companies,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editRecurring: IRecurringInvoice | null;
  companies: ICompany[];
}) {
  const isEdit = !!editRecurring;
  const sellers = companies.filter(c => c.isOwn);
  const buyers = companies.filter(c => !c.isOwn);

  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState('MONTHLY');
  const [nextIssueDate, setNextIssueDate] = useState(today());
  const [type, setType] = useState('STANDARD');
  const [sellerId, setSellerId] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('przelew');
  const [bankAccount, setBankAccount] = useState('');
  const [currency, setCurrency] = useState('PLN');
  const [dueDays, setDueDays] = useState('14');
  const [notes, setNotes] = useState('');
  const [autoIssue, setAutoIssue] = useState(false);
  const [autoSend, setAutoSend] = useState(false);
  const [items, setItems] = useState<{ description: string; unit: string; quantity: string; unitPrice: string; vatRate: string }[]>([
    { description: '', unit: 'usł.', quantity: '1', unitPrice: '', vatRate: '23' },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editRecurring) {
      setName(editRecurring.name);
      setFrequency(editRecurring.frequency);
      setNextIssueDate(editRecurring.nextIssueDate?.split('T')[0] ?? today());
      setType(editRecurring.type);
      setSellerId(editRecurring.sellerId);
      setBuyerId(editRecurring.buyerId);
      setPaymentMethod(editRecurring.paymentMethod);
      setBankAccount(editRecurring.bankAccount ?? '');
      setCurrency(editRecurring.currency);
      setDueDays(String(editRecurring.dueDays));
      setNotes(editRecurring.notes ?? '');
      setAutoIssue(editRecurring.autoIssue);
      setAutoSend(editRecurring.autoSend);
      const tpl = editRecurring.itemsTemplate ?? [];
      setItems(tpl.length > 0 ? tpl.map((i: any) => ({
        description: i.description ?? '',
        unit: i.unit ?? 'usł.',
        quantity: String(i.quantity ?? 1),
        unitPrice: String(i.unitPrice ?? ''),
        vatRate: i.vatRate ?? '23',
      })) : [{ description: '', unit: 'usł.', quantity: '1', unitPrice: '', vatRate: '23' }]);
    } else {
      setName(''); setFrequency('MONTHLY'); setNextIssueDate(today()); setType('STANDARD');
      setSellerId(sellers[0]?.id ?? ''); setBuyerId(''); setPaymentMethod('przelew');
      setBankAccount(''); setCurrency('PLN'); setDueDays('14'); setNotes('');
      setAutoIssue(false); setAutoSend(false);
      setItems([{ description: '', unit: 'usł.', quantity: '1', unitPrice: '', vatRate: '23' }]);
    }
  }, [editRecurring, open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name, frequency, nextIssueDate, type, sellerId, buyerId, paymentMethod,
        bankAccount: bankAccount || undefined, currency, dueDays: parseInt(dueDays) || 14,
        notes: notes || undefined, autoIssue, autoSend,
        items: items.filter(i => i.description).map((i, idx) => ({
          sortOrder: idx,
          description: i.description,
          unit: i.unit,
          quantity: parseFloat(i.quantity) || 1,
          unitPrice: parseFloat(i.unitPrice) || 0,
          vatRate: i.vatRate,
        })),
      };

      if (isEdit) await api.updateRecurringInvoice(editRecurring!.id, payload);
      else await api.createRecurringInvoice(payload);

      onSaved();
      onClose();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const addItem = () => setItems([...items, { description: '', unit: 'usł.', quantity: '1', unitPrice: '', vatRate: '23' }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, value: string) => {
    const next = [...items];
    (next[idx] as any)[field] = value;
    setItems(next);
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edytuj szablon cykliczny' : 'Nowy szablon cykliczny'}</DialogTitle>
          <DialogDescription>Szablon faktury generowanej automatycznie wg harmonogramu.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Nazwa szablonu</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="np. Hosting - Klient X" />
          </div>
          <div>
            <Label>Częstotliwość</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Następne wystawienie</Label>
            <Input type="date" value={nextIssueDate} onChange={e => setNextIssueDate(e.target.value)} />
          </div>
          <div>
            <Label>Typ faktury</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(INVOICE_TYPES).filter(([k]) => k !== 'CORRECTION').map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Sprzedawca</Label>
            <Select value={sellerId} onValueChange={setSellerId}>
              <SelectTrigger><SelectValue placeholder="Wybierz..." /></SelectTrigger>
              <SelectContent>
                {sellers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nabywca</Label>
            <Select value={buyerId} onValueChange={setBuyerId}>
              <SelectTrigger><SelectValue placeholder="Wybierz..." /></SelectTrigger>
              <SelectContent>
                {buyers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Metoda płatności</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Waluta</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['PLN', 'EUR', 'USD', 'GBP', 'CHF'].map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Termin płatności (dni)</Label>
            <Input type="number" value={dueDays} onChange={e => setDueDays(e.target.value)} min="1" />
          </div>
          <div>
            <Label>Nr konta bankowego</Label>
            <Input value={bankAccount} onChange={e => setBankAccount(e.target.value)} placeholder="Opcjonalnie" />
          </div>
        </div>

        <div className="flex items-center gap-4 mt-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoIssue} onChange={e => setAutoIssue(e.target.checked)} className="rounded" />
            Auto-wystawianie
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoSend} onChange={e => setAutoSend(e.target.checked)} className="rounded" />
            Auto-wysyłka e-mail
          </label>
        </div>

        <Separator />

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-base">Pozycje</Label>
            <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> Dodaj</Button>
          </div>
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-1 mb-1 items-end">
              <div className="col-span-4">
                {idx === 0 && <Label className="text-xs">Opis</Label>}
                <Input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Opis usługi/towaru" />
              </div>
              <div className="col-span-1">
                {idx === 0 && <Label className="text-xs">Jedn.</Label>}
                <Select value={item.unit} onValueChange={v => updateItem(idx, 'unit', v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                {idx === 0 && <Label className="text-xs">Ilość</Label>}
                <Input value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} type="number" step="0.01" />
              </div>
              <div className="col-span-2">
                {idx === 0 && <Label className="text-xs">Cena netto</Label>}
                <Input value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', e.target.value)} type="number" step="0.01" />
              </div>
              <div className="col-span-2">
                {idx === 0 && <Label className="text-xs">VAT</Label>}
                <Select value={item.vatRate} onValueChange={v => updateItem(idx, 'vatRate', v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{VAT_RATES.map(r => <SelectItem key={r} value={r}>{r === 'zw' ? 'zw.' : r === 'np' ? 'np.' : `${r}%`}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-1 flex justify-center">
                {items.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removeItem(idx)} className="text-destructive h-9 w-9 p-0">
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div>
          <Label>Uwagi</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={onClose}>Anuluj</Button>
          <Button onClick={handleSave} disabled={saving || !name || !sellerId || !buyerId}>
            {saving ? 'Zapisywanie...' : isEdit ? 'Zapisz zmiany' : 'Utwórz szablon'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ──────── Charts Tab ────────

function ChartsTab() {
  const [chartData, setChartData] = useState<any>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [showJpkDialog, setShowJpkDialog] = useState(false);

  const loadChartData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getInvoiceChartData(year);
      setChartData(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [year]);

  useEffect(() => { loadChartData(); }, [loadChartData]);

  if (loading) return <div className="flex justify-center py-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setYear(y => y - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-lg font-semibold min-w-[80px] text-center">{year}</span>
          <Button variant="outline" size="icon" onClick={() => setYear(y => y + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <Button variant="outline" onClick={() => setShowJpkDialog(true)}>
          <FileDown className="h-4 w-4 mr-1" /> Eksport JPK_FA
        </Button>
      </div>

      {chartData && (
        <>
          {/* Monthly Revenue Line Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Przychody miesięczne</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData.monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: any) => fmtCurrency(Number(value))} />
                  <Legend />
                  <Line type="monotone" dataKey="gross" stroke="#3b82f6" name="Brutto" strokeWidth={2} />
                  <Line type="monotone" dataKey="net" stroke="#22c55e" name="Netto" strokeWidth={2} />
                  <Line type="monotone" dataKey="paid" stroke="#10b981" name="Opłacone" strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="unpaid" stroke="#ef4444" name="Nieopłacone" strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* VAT Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rozkład VAT</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.vatPieChart?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={chartData.vatPieChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                        {chartData.vatPieChart.map((_: any, idx: number) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => fmtCurrency(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-muted-foreground py-8">Brak danych</div>
                )}
              </CardContent>
            </Card>

            {/* Revenue by Client Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Przychód wg kontrahentów (TOP 10)</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.clientChart?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData.clientChart} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: any) => fmtCurrency(Number(value))} />
                      <Bar dataKey="gross" fill="#3b82f6" name="Brutto" radius={[0, 4, 4, 0]}>
                        {chartData.clientChart.map((_: any, idx: number) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-muted-foreground py-8">Brak danych</div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <JpkExportDialog open={showJpkDialog} onClose={() => setShowJpkDialog(false)} />
    </div>
  );
}

// ──────── Audit Log Dialog ────────

interface IAuditLog {
  id: string;
  action: string;
  changes: any;
  userId?: string;
  userName?: string;
  createdAt: string;
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATED: 'Utworzono',
  UPDATED: 'Zaktualizowano',
  ISSUED: 'Wystawiono',
  SENT: 'Wysłano',
  PAID: 'Opłacono',
  CANCELLED: 'Anulowano',
  CORRECTED: 'Skorygowano',
  DELETED: 'Usunięto',
};

function AuditLogDialog({ open, onClose, invoiceId, invoiceNumber }: {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceNumber: string;
}) {
  const [logs, setLogs] = useState<IAuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && invoiceId) {
      setLoading(true);
      api.getInvoiceAuditLog(invoiceId)
        .then(data => setLogs(data as IAuditLog[]))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open, invoiceId]);

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historia zmian: {invoiceNumber}</DialogTitle>
          <DialogDescription>Dziennik operacji wykonanych na fakturze.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">Brak wpisów w dzienniku.</p>
        ) : (
          <div className="space-y-2">
            {logs.map(log => (
              <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{AUDIT_ACTION_LABELS[log.action] ?? log.action}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString('pl-PL')}</span>
                  </div>
                  {log.changes && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {typeof log.changes === 'object' ? Object.entries(log.changes).map(([k, v]) => (
                        <span key={k} className="mr-2">{k}: {String(v)}</span>
                      )) : String(log.changes)}
                    </div>
                  )}
                  {log.userName && <span className="text-xs text-muted-foreground">przez {log.userName}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ──────── Send Email Dialog ────────

function SendEmailDialog({ open, onClose, invoice, onSent }: {
  open: boolean;
  onClose: () => void;
  invoice: IInvoice | null;
  onSent: () => void;
}) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (invoice && open) {
      setTo(invoice.buyer?.email ?? '');
      setSubject(`Faktura ${invoice.number} - ${invoice.seller?.name ?? ''}`);
      setBody('');
    }
  }, [invoice, open]);

  const handleSend = async () => {
    if (!invoice) return;
    setSending(true);
    try {
      await api.sendInvoiceEmail(invoice.id, {
        to: to || undefined,
        subject: subject || undefined,
        body: body || undefined,
      });
      onSent();
      onClose();
    } catch (e) {
      console.error(e);
      alert('Nie udało się wysłać e-maila. Sprawdź konfigurację SMTP.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Wyślij fakturę e-mailem</DialogTitle>
          <DialogDescription>Faktura {invoice?.number} zostanie wysłana jako załącznik.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Adres e-mail odbiorcy</Label>
            <Input value={to} onChange={e => setTo(e.target.value)} type="email" placeholder="jan@firma.pl" />
          </div>
          <div>
            <Label>Temat</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div>
            <Label>Treść (opcjonalnie)</Label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} rows={4} placeholder="Domyślna treść zostanie wygenerowana automatycznie." />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={onClose}>Anuluj</Button>
          <Button onClick={handleSend} disabled={sending || !to}>
            {sending ? 'Wysyłanie...' : <><Mail className="h-4 w-4 mr-1" /> Wyślij</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ──────── JPK_FA Export Dialog ────────

function JpkExportDialog({ open, onClose }: {
  open: boolean;
  onClose: () => void;
}) {
  const currentYear = new Date().getFullYear();
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`);
  const [dateTo, setDateTo] = useState(`${currentYear}-12-31`);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await api.exportJpkFa(dateFrom, dateTo);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `JPK_FA_${dateFrom}_${dateTo}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      console.error(e);
      alert('Nie udało się wygenerować pliku JPK_FA.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Eksport JPK_FA</DialogTitle>
          <DialogDescription>Wygeneruj plik XML zgodny z JPK_FA dla wybranego zakresu dat.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Data od</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label>Data do</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={onClose}>Anuluj</Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? 'Generowanie...' : <><FileDown className="h-4 w-4 mr-1" /> Pobierz XML</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ──────── Stats Tab ────────

function StatsTab() {
  const [stats, setStats] = useState<IInvoiceStats | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getInvoiceStats(year);
      setStats(data as IInvoiceStats);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [year]);

  useEffect(() => { loadStats(); }, [loadStats]);

  if (loading) return <div className="flex justify-center py-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setYear(y => y - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-lg font-semibold min-w-[80px] text-center">{year}</span>
        <Button variant="outline" size="icon" onClick={() => setYear(y => y + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Wystawione faktury</div>
              <div className="text-2xl font-bold">{stats.totalInvoices}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Przychód netto</div>
              <div className="text-2xl font-bold">{fmtCurrency(stats.totalNet)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Opłacone</div>
              <div className="text-2xl font-bold text-green-600">{fmtCurrency(stats.paidGross)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Nieopłacone</div>
              <div className="text-2xl font-bold text-orange-600">{fmtCurrency(stats.unpaidGross)}</div>
              {stats.overdueCount > 0 && (
                <div className="text-xs text-red-500">{stats.overdueCount} po terminie</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ──────── Company Dialog (shared for Own / Contractors) ────────

function CompanyDialog({
  open, onClose, onSaved, editCompany, isOwn,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editCompany: ICompany | null;
  isOwn: boolean;
}) {
  const isEdit = !!editCompany;

  const [name, setName] = useState('');
  const [nip, setNip] = useState('');
  const [regon, setRegon] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('Polska');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editCompany) {
      setName(editCompany.name);
      setNip(editCompany.nip ?? '');
      setRegon(editCompany.regon ?? '');
      setAddress(editCompany.address ?? '');
      setCity(editCompany.city ?? '');
      setPostalCode(editCompany.postalCode ?? '');
      setCountry(editCompany.country ?? 'Polska');
      setEmail(editCompany.email ?? '');
      setPhone(editCompany.phone ?? '');
      setBankName(editCompany.bankName ?? '');
      setBankAccount(editCompany.bankAccount ?? '');
    } else {
      setName(''); setNip(''); setRegon(''); setAddress(''); setCity('');
      setPostalCode(''); setCountry('Polska'); setEmail(''); setPhone('');
      setBankName(''); setBankAccount('');
    }
  }, [editCompany, open]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        nip: nip.trim() || undefined,
        regon: regon.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        country: country.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        bankName: bankName.trim() || undefined,
        bankAccount: bankAccount.trim() || undefined,
        isOwn,
      };

      if (isEdit) {
        await api.updateCompany(editCompany!.id, payload);
      } else {
        await api.createCompany(payload);
      }

      onSaved();
      onClose();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edytuj' : 'Dodaj'} {isOwn ? 'dane firmy' : 'kontrahenta'}
          </DialogTitle>
          <DialogDescription>
            {isOwn ? 'Dane Twojej firmy widoczne na fakturach' : 'Dane kontrahenta (nabywcy faktur)'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Nazwa firmy *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nazwa firmy" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>NIP</Label>
              <Input value={nip} onChange={e => setNip(e.target.value)} placeholder="0000000000" />
            </div>
            <div>
              <Label>REGON</Label>
              <Input value={regon} onChange={e => setRegon(e.target.value)} placeholder="000000000" />
            </div>
          </div>

          <div>
            <Label>Adres</Label>
            <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="ul. Przykładowa 1" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Kod pocztowy</Label>
              <Input value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="00-000" />
            </div>
            <div className="col-span-2">
              <Label>Miasto</Label>
              <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Warszawa" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="firma@example.com" />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+48 000 000 000" />
            </div>
          </div>

          {(isOwn || bankName || bankAccount) && (
            <>
              <Separator />
              <div>
                <Label>Nazwa banku</Label>
                <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Nazwa banku" />
              </div>
              <div>
                <Label>Numer konta</Label>
                <Input value={bankAccount} onChange={e => setBankAccount(e.target.value)} placeholder="PL XX XXXX XXXX XXXX XXXX XXXX XXXX" />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Anuluj</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? 'Zapisywanie...' : isEdit ? 'Zapisz' : 'Dodaj'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ──────── PDF Generation (Client-side) ────────

async function generatePdf(invoice: IInvoice) {
  try {
    // Fetch structured data from backend
    const data = await api.getInvoicePdfData(invoice.id) as any;

    // Build printable HTML and use browser print
    const html = buildInvoiceHtml(data);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      // delay to let styles render
      setTimeout(() => printWindow.print(), 500);
    }
  } catch (e) {
    console.error('PDF generation failed:', e);
  }
}

function buildInvoiceHtml(data: any): string {
  const { invoice, seller, buyer, items, vatSummary } = data;

  const typeLabel = INVOICE_TYPES[invoice.type] ?? 'Faktura';
  const displayTitle = invoice.title || `${typeLabel} nr ${escapeHtml(invoice.number)}`;
  const issueDate = fmtDate(invoice.issueDate);
  const saleDate = fmtDate(invoice.saleDate);
  const dueDate = fmtDate(invoice.dueDate);
  const paymentLabel = PAYMENT_METHODS[invoice.paymentMethod] ?? invoice.paymentMethod;
  const isVatExempt = invoice.type === 'VAT_EXEMPT';

  const itemsRows = items
    .map((item: any, i: number) => `
      <tr>
        <td style="padding:4px 8px;border:1px solid #ddd;text-align:center">${i + 1}</td>
        <td style="padding:4px 8px;border:1px solid #ddd">${escapeHtml(item.description)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;text-align:center">${escapeHtml(item.unit)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${item.quantity}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${item.unitPrice.toFixed(2)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${item.netAmount.toFixed(2)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;text-align:center">${item.vatRate === 'zw' ? 'zw.' : item.vatRate === 'np' ? 'np.' : item.vatRate + '%'}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${item.vatAmount.toFixed(2)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${item.grossAmount.toFixed(2)}</td>
      </tr>
    `)
    .join('');

  const vatRows = vatSummary
    .map((v: any) => `
      <tr>
        <td style="padding:4px 8px;border:1px solid #ddd">${v.vatRate === 'zw' ? 'zwolniony' : v.vatRate === 'np' ? 'nie podlega' : v.vatRate + '%'}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${v.netAmount.toFixed(2)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${v.vatAmount.toFixed(2)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${v.grossAmount.toFixed(2)}</td>
      </tr>
    `)
    .join('');

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(displayTitle)}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #333; margin: 20px; }
    h1 { font-size: 20px; margin-bottom: 5px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
    .parties { display: flex; justify-content: space-between; margin-bottom: 20px; }
    .party { width: 45%; }
    .party h3 { font-size: 13px; color: #666; margin-bottom: 5px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    th { background: #f5f5f5; padding: 6px 8px; border: 1px solid #ddd; font-size: 11px; }
    .totals { text-align: right; margin-top: 10px; }
    .totals .big { font-size: 16px; font-weight: bold; }
    .footer { margin-top: 40px; display: flex; justify-content: space-between; }
    .signature { width: 200px; text-align: center; border-top: 1px solid #333; padding-top: 5px; font-size: 11px; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(displayTitle)}</h1>
      <div><strong>Nr:</strong> ${escapeHtml(invoice.number)}</div>
      ${invoice.title ? `<div style="font-size:11px;color:#666">${escapeHtml(typeLabel)}</div>` : ''}
    </div>
    <div style="text-align:right">
      ${invoice.issuePlace ? `<div>Miejsce wystawienia: <strong>${escapeHtml(invoice.issuePlace)}</strong></div>` : ''}
      <div>Data wystawienia: <strong>${issueDate}</strong></div>
      <div>Data sprzedaży: <strong>${saleDate}</strong></div>
      <div>Termin płatności: <strong>${dueDate}</strong></div>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h3>Sprzedawca</h3>
      <div><strong>${escapeHtml(seller.name)}</strong></div>
      ${seller.nip ? `<div>NIP: ${escapeHtml(seller.nip)}</div>` : ''}
      ${seller.address ? `<div>${escapeHtml(seller.address)}</div>` : ''}
      ${seller.city ? `<div>${escapeHtml(seller.postalCode || '')} ${escapeHtml(seller.city)}</div>` : ''}
      ${seller.bankName ? `<div>Bank: ${escapeHtml(seller.bankName)}</div>` : ''}
      ${seller.bankAccount ? `<div>Nr konta: ${escapeHtml(seller.bankAccount)}</div>` : ''}
    </div>
    <div class="party">
      <h3>Nabywca</h3>
      <div><strong>${escapeHtml(buyer.name)}</strong></div>
      ${buyer.nip ? `<div>NIP: ${escapeHtml(buyer.nip)}</div>` : ''}
      ${buyer.address ? `<div>${escapeHtml(buyer.address)}</div>` : ''}
      ${buyer.city ? `<div>${escapeHtml(buyer.postalCode || '')} ${escapeHtml(buyer.city)}</div>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:30px">Lp.</th>
        <th>Nazwa usługi/towaru</th>
        <th style="width:50px">J.m.</th>
        <th style="width:50px">Ilość</th>
        <th style="width:80px">Cena netto</th>
        <th style="width:80px">Wartość netto</th>
        <th style="width:50px">VAT</th>
        <th style="width:80px">Kwota VAT</th>
        <th style="width:80px">Wartość brutto</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  <div style="display:flex;justify-content:flex-end">
    <table style="width:350px">
      <thead>
        <tr>
          <th>Stawka VAT</th>
          <th>Netto</th>
          <th>VAT</th>
          <th>Brutto</th>
        </tr>
      </thead>
      <tbody>
        ${vatRows}
        <tr style="font-weight:bold">
          <td style="padding:4px 8px;border:1px solid #ddd">Razem</td>
          <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${invoice.totalNet.toFixed(2)}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${invoice.totalVat.toFixed(2)}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${invoice.totalGross.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="totals">
    <div>Sposób płatności: <strong>${escapeHtml(paymentLabel)}</strong></div>
    <div class="big" style="margin-top:5px">Do zapłaty: ${invoice.totalGross.toFixed(2)} ${escapeHtml(invoice.currency)}</div>
    <div style="font-size:11px;color:#666">Słownie: ${numberToWords(invoice.totalGross)} ${escapeHtml(invoice.currency)}</div>
  </div>

  ${invoice.notes ? `<div style="margin-top:15px;padding:8px;background:#f9f9f9;border-radius:4px"><strong>Uwagi:</strong> ${escapeHtml(invoice.notes)}</div>` : ''}

  ${isVatExempt ? `<div style="margin-top:15px;padding:8px;background:#fffbe6;border:1px solid #ffe58f;border-radius:4px;font-size:11px">
    <strong>Podstawa zwolnienia od podatku VAT:</strong> Zwolnienie na podstawie art. 113 ust. 1 i 9 ustawy z dnia 11 marca 2004 r. o podatku od towarów i usług (Dz.U. z 2024 r. poz. 361).
  </div>` : ''}

  <div class="footer">
    <div class="signature">Podpis wystawcy</div>
    <div class="signature">Podpis odbiorcy</div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function numberToWords(amount: number): string {
  const intPart = Math.floor(amount);
  const decPart = Math.round((amount - intPart) * 100);

  const ones = ['', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć'];
  const teens = ['dziesięć', 'jedenaście', 'dwanaście', 'trzynaście', 'czternaście', 'piętnaście', 'szesnaście', 'siedemnaście', 'osiemnaście', 'dziewiętnaście'];
  const tens = ['', 'dziesięć', 'dwadzieścia', 'trzydzieści', 'czterdzieści', 'pięćdziesiąt', 'sześćdziesiąt', 'siedemdziesiąt', 'osiemdziesiąt', 'dziewięćdziesiąt'];
  const hundreds = ['', 'sto', 'dwieście', 'trzysta', 'czterysta', 'pięćset', 'sześćset', 'siedemset', 'osiemset', 'dziewięćset'];

  function convertGroup(n: number): string {
    if (n === 0) return '';
    let result = '';
    if (n >= 100) { result += hundreds[Math.floor(n / 100)] + ' '; n %= 100; }
    if (n >= 10 && n < 20) { result += teens[n - 10] + ' '; return result.trim(); }
    if (n >= 10) { result += tens[Math.floor(n / 10)] + ' '; n %= 10; }
    if (n > 0) result += ones[n] + ' ';
    return result.trim();
  }

  if (intPart === 0) return `zero ${decPart}/100`;

  let words = '';
  if (intPart >= 1000) {
    const thousands = Math.floor(intPart / 1000);
    if (thousands === 1) words += 'tysiąc ';
    else if (thousands >= 2 && thousands <= 4) words += convertGroup(thousands) + ' tysiące ';
    else words += convertGroup(thousands) + ' tysięcy ';
  }

  const remainder = intPart % 1000;
  if (remainder > 0) words += convertGroup(remainder);

  return `${words.trim()} ${decPart}/100`;
}
