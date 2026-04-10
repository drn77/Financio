import { BadRequestException, Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReceiptActionsService } from './receipt-actions.service';
import { TemplateActionsService } from '../template/template-actions.service';
import { RecordActionsService } from '../template/record-actions.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';
import { PrismaService } from '../../shared/prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

export interface IParsedReceipt {
  storeName: string | null;
  date: string | null;
  items: Array<{ name: string; quantity: number; unitPrice: number; total: number }>;
  total: number;
  description: string | null;
  formattedText: string | null;
}

export interface IReceiptExpenseMappingConfig {
  amountFieldId?: string | null;
  dateFieldId?: string | null;
  descriptionFieldId?: string | null;
  notesFieldId?: string | null;
  personFieldId?: string | null;
  storeFieldId?: string | null;
  categoryFieldId?: string | null;
  itemsFieldId?: string | null;
  autoTagIds?: string[];
}

export type ReceiptSourceField =
  | 'amount'
  | 'date'
  | 'description'
  | 'notes'
  | 'person'
  | 'store'
  | 'category'
  | 'items'
  | 'tags';

export type ReceiptFieldMode = 'none' | 'map' | 'auto_tags' | 'receipt_configurable';

export interface IReceiptFieldConfig {
  mode: ReceiptFieldMode;
  receiptFieldId?: ReceiptSourceField | null;
  autoTagIds?: string[];
  required?: boolean;
}

export interface IReceiptConfigResponse {
  expenseMapping: IReceiptExpenseMappingConfig;
  availableFields: Array<{
    id: string;
    name: string;
    type: string;
    required?: boolean;
    options?: string[];
    currencyOptions?: string[];
    tagGroupId?: string | null;
    allowMultiple?: boolean;
  }>;
  receiptFields: Array<{ id: ReceiptSourceField; name: string }>;
  fieldConfigs: Record<string, IReceiptFieldConfig>;
}

const RECEIPT_SOURCE_FIELDS: Array<{ id: ReceiptSourceField; name: string }> = [
  { id: 'amount', name: 'Kwota paragonu' },
  { id: 'date', name: 'Data paragonu' },
  { id: 'description', name: 'Opis paragonu' },
  { id: 'notes', name: 'Notatki paragonu' },
  { id: 'person', name: 'Osoba z paragonu' },
  { id: 'store', name: 'Sklep z paragonu' },
  { id: 'category', name: 'Kategoria z paragonu' },
  { id: 'items', name: 'Pozycje paragonu' },
  { id: 'tags', name: 'Tagi paragonu' },
];

const RECEIPT_SOURCE_FIELD_IDS = new Set(RECEIPT_SOURCE_FIELDS.map((f) => f.id));
const RECEIPT_FIELD_MODES = new Set<ReceiptFieldMode>(['none', 'map', 'auto_tags', 'receipt_configurable']);

@Injectable()
export class ReceiptContextService implements OnModuleInit {
  private readonly logger = new Logger(ReceiptContextService.name);

  constructor(
    private readonly receiptActions: ReceiptActionsService,
    private readonly templateActions: TemplateActionsService,
    private readonly recordActions: RecordActionsService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // #region Private
  private async parseReceiptWithAI(rawText: string): Promise<IParsedReceipt | null> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
    this.logger.log(`AI parsing: apiKey=${apiKey ? 'present(' + apiKey.length + ' chars)' : 'MISSING'}, textLen=${rawText.trim().length}`);
    if (!apiKey || rawText.trim().length < 20) return null;

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);

    const prompt = `Jesteś systemem parsującym tekst z OCR paragonów i faktur (polski format).
Wyciągnij strukturalne dane i zwróć TYLKO poprawny JSON bez żadnych komentarzy ani markdown.

Format odpowiedzi:
{
  "storeName": "nazwa sklepu/wystawcy lub null",
  "date": "YYYY-MM-DD lub null",
  "items": [
    {"name": "nazwa towaru/usługi", "quantity": 1.0, "unitPrice": 10.50, "total": 10.50}
  ],
  "total": 187.99,
  "description": "krótki opis zakupu np. Tankowanie paliwa - ORLEN",
  "formattedText": "sformatowany tekst faktury w czytelnej formie"
}

Zasady:
- items: wyciągnij WSZYSTKIE pozycje z listy towarów/usług. Ilość i ceny jako liczby.
- total: kwota ogółem do zapłaty / razem brutto.
- description: krótki opis transakcji (max 60 znaków).
- formattedText: przeformatuj surowy OCR do czytelnej formy, łącząc fragmenty logicznie.
  Użyj formatu: nagłówek, dane sprzedawcy/nabywcy, tabela pozycji, podsumowanie.
- Jeśli nie jesteś pewien wartości, użyj null.
- Wartości liczbowe jako NUMBER, nie string.

Tekst OCR:
${rawText.slice(0, 5000)}`;

    // Try multiple models in case one hits quota limits
    const models = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];
    let lastError: Error | null = null;

    for (const modelName of models) {
      try {
        this.logger.log(`AI parsing: trying model=${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          this.logger.warn(`AI parsing (${modelName}): no JSON in response`);
          continue;
        }

        const data = JSON.parse(jsonMatch[0]);

        const items = Array.isArray(data.items)
          ? data.items
              .filter((it: any) => it && typeof it.name === 'string' && it.name.trim())
              .map((it: any) => ({
                name: String(it.name).trim(),
                quantity: typeof it.quantity === 'number' && isFinite(it.quantity) ? it.quantity : 1,
                unitPrice: typeof it.unitPrice === 'number' && isFinite(it.unitPrice) ? Math.round(it.unitPrice * 100) / 100 : 0,
                total: typeof it.total === 'number' && isFinite(it.total) ? Math.round(it.total * 100) / 100 : 0,
              }))
          : [];

        this.logger.log(`AI parsing (${modelName}): success, items=${items.length}, total=${data.total}`);
        return {
          storeName: typeof data.storeName === 'string' ? data.storeName : null,
          date: typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : null,
          items,
          total: typeof data.total === 'number' && isFinite(data.total) ? Math.round(data.total * 100) / 100 : 0,
          description: typeof data.description === 'string' ? data.description.slice(0, 200) : null,
          formattedText: typeof data.formattedText === 'string' ? data.formattedText.slice(0, 3000) : null,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const is429 = lastError.message.includes('429') || lastError.message.includes('quota');
        this.logger.warn(`AI parsing (${modelName}) failed: ${is429 ? '429 quota' : lastError.message.slice(0, 120)}`);
        // If 429, try next model immediately
        if (!is429) break; // Non-quota error, don't try other models
      }
    }

    // All models failed — throw so diagnostics can capture the reason
    throw lastError || new Error('All AI models failed');
  }

  private async _autoCreateExpense(
    familyId: string,
    receipt: {
      id: string;
      description: string;
      amount: number;
      currency?: string;
      date: Date;
      notes?: string | null;
      categoryId?: string | null;
      personId?: string | null;
      storeId?: string | null;
      items?: Array<{ name: string; quantity: number; unitPrice: number; total: number }>;
      configurableFields?: Record<string, unknown> | null;
    },
  ) {
    try {
      const defaultTemplate = await this.templateActions.findDefaultTemplate(familyId);
      if (!defaultTemplate) return;

      const maxSort = await this.recordActions.getMaxSortOrder(defaultTemplate.id);

      const columns = Array.isArray((defaultTemplate as any).columns) ? ((defaultTemplate as any).columns as any[]) : [];
      const config = await this.getConfig(familyId);

      const recordData: Record<string, any> = {
        _receiptId: receipt.id,
        _receiptDescription: receipt.description,
      };
      const configuredFieldValues = ((receipt as any).configurableFields as Record<string, unknown>) ?? {};

      const [store, category, member] = await Promise.all([
        receipt.storeId
          ? this.prisma.store.findUnique({ where: { id: receipt.storeId }, select: { name: true } })
          : Promise.resolve(null),
        receipt.categoryId
          ? this.prisma.category.findUnique({ where: { id: receipt.categoryId }, select: { name: true } })
          : Promise.resolve(null),
        receipt.personId
          ? this.prisma.familyMember.findUnique({
              where: { id: receipt.personId },
              include: { user: { select: { username: true, firstName: true } } },
            })
          : Promise.resolve(null),
      ]);

      const personName = member?.nickname || member?.user?.firstName || member?.user?.username || null;
      const itemsAsText = Array.isArray(receipt.items) && receipt.items.length > 0
        ? receipt.items.map((item) => `${item.name} x${item.quantity} = ${Number(item.total).toFixed(2)} PLN`).join('\n')
        : null;
      const receiptTagNames = Array.isArray((receipt as any).tags)
        ? ((receipt as any).tags as any[]).map((tag) => String(tag?.name ?? '')).filter(Boolean)
        : [];

      const receiptValues: Record<ReceiptSourceField, any> = {
        amount: { amount: Number(receipt.amount), currency: receipt.currency ?? 'PLN' },
        date: new Date(receipt.date).toISOString().split('T')[0],
        description: receipt.description,
        notes: receipt.notes ?? null,
        person: personName,
        store: store?.name ?? null,
        category: category?.name ?? null,
        items: itemsAsText,
        tags: receiptTagNames,
      };

      const autoTagIdPool = new Set<string>();
      const missingRequired: string[] = [];

      for (const column of columns) {
        const columnId = String(column?.id ?? '');
        if (!columnId) continue;
        const cfg = config.fieldConfigs[columnId];
        if (!cfg || cfg.mode === 'none') continue;

        if (cfg.mode === 'auto_tags' && column?.type === 'tag_group') {
          for (const tagId of cfg.autoTagIds ?? []) autoTagIdPool.add(tagId);
          continue;
        }

        if ((cfg.mode === 'map' || cfg.mode === 'receipt_configurable')) {
          const rawValue = cfg.mode === 'receipt_configurable'
            ? configuredFieldValues[columnId]
            : (cfg.receiptFieldId ? receiptValues[cfg.receiptFieldId] : null);
          if (rawValue == null) continue;
          if (column?.type === 'tag_group') {
            const existing = recordData[columnId];
            const fromSource = Array.isArray(rawValue) ? rawValue : [rawValue];
            const normalized = fromSource.map((v) => String(v)).filter(Boolean);
            const existingNames = Array.isArray(existing) ? existing.map((v: any) => String(v)).filter(Boolean) : [];
            const merged = Array.from(new Set([...existingNames, ...normalized]));
            if (merged.length > 0) recordData[columnId] = merged;
            continue;
          }
          recordData[columnId] = rawValue;
        }

        if (cfg.required) {
          const candidate = recordData[columnId];
          const isEmptyArray = Array.isArray(candidate) && candidate.length === 0;
          const isEmptyString = typeof candidate === 'string' && candidate.trim().length === 0;
          const isEmptyObject = candidate
            && typeof candidate === 'object'
            && !Array.isArray(candidate)
            && Object.keys(candidate).length === 0;
          if (candidate == null || isEmptyArray || isEmptyString || isEmptyObject) {
            missingRequired.push(String(column?.name ?? columnId));
          }
        }
      }

      if (autoTagIdPool.size > 0) {
        const configuredTags = await this.prisma.tag.findMany({
          where: { id: { in: Array.from(autoTagIdPool) }, tagGroup: { familyId } },
          select: { id: true, name: true },
        });
        const tagNamesById = new Map(configuredTags.map((tag) => [tag.id, tag.name]));

        for (const column of columns) {
          const columnId = String(column?.id ?? '');
          if (!columnId || column?.type !== 'tag_group') continue;
          const cfg = config.fieldConfigs[columnId];
          if (!cfg || cfg.mode !== 'auto_tags') continue;

          const names = (cfg.autoTagIds ?? []).map((id) => tagNamesById.get(id)).filter(Boolean) as string[];
          if (names.length === 0) continue;

          const existing = recordData[columnId];
          const existingNames = Array.isArray(existing) ? existing.map((v: any) => String(v)).filter(Boolean) : [];
          const merged = Array.from(new Set([...existingNames, ...names]));
          if (merged.length > 0) recordData[columnId] = merged;
        }
      }

      if (missingRequired.length > 0) {
        throw new BadRequestException(`Uzupełnij wymagane pola paragonu: ${missingRequired.join(', ')}`);
      }

      const paidCheckboxCol = columns.find((c: any) => c?.type === 'checkbox' && typeof c?.id === 'string' && /paid|oplac|zaplac|rozlicz/i.test(String(c?.id ?? '') + ' ' + String(c?.name ?? '')));
      if (paidCheckboxCol) {
        recordData[paidCheckboxCol.id] = true;
      } else {
        recordData.col_paid = true;
      }

      await this.recordActions.createRecord({
        templateId: defaultTemplate.id,
        data: recordData,
        sortOrder: maxSort + 1,
      });
    } catch (e) {
      this.logger.error('Auto-expense creation failed for receipt', e);
      throw e;
    }
  }

  async getConfig(familyId: string): Promise<IReceiptConfigResponse> {
    const [family, defaultTemplate] = await Promise.all([
      this.prisma.family.findUnique({ where: { id: familyId }, select: { dashboardConfig: true } }),
      this.templateActions.findDefaultTemplate(familyId),
    ]);

    if (!family) throw new NotFoundException('Family not found');

    const columns = Array.isArray((defaultTemplate as any)?.columns) ? ((defaultTemplate as any).columns as any[]) : [];
    const availableFields = columns
      .filter((c: any) => typeof c?.id === 'string')
      .map((c: any) => ({
        id: c.id,
        name: c.name ?? c.id,
        type: c.type ?? 'text',
        required: !!c.required,
        options: Array.isArray(c.options) ? c.options.map((v: any) => String(v)) : undefined,
        currencyOptions: Array.isArray(c.currencyOptions) ? c.currencyOptions.map((v: any) => String(v)) : undefined,
        tagGroupId: c.tagGroupId ? String(c.tagGroupId) : null,
        allowMultiple: c.allowMultiple !== false,
      }));

    const rawDashboardConfig = (family.dashboardConfig as any) ?? {};
    const rawConfig = (rawDashboardConfig?.receiptExpenseMapping ?? {}) as IReceiptExpenseMappingConfig;
    const rawFieldConfigs = (rawDashboardConfig?.receiptExpenseFieldConfigs ?? {}) as Record<string, any>;
    const validIds = new Set(availableFields.map((field) => field.id));
    const tagIds = await this.prisma.tag.findMany({ where: { tagGroup: { familyId } }, select: { id: true } });
    const validTagIds = new Set(tagIds.map((tag) => tag.id));
    const expenseMapping: IReceiptExpenseMappingConfig = {
      amountFieldId: rawConfig.amountFieldId && validIds.has(rawConfig.amountFieldId) ? rawConfig.amountFieldId : null,
      dateFieldId: rawConfig.dateFieldId && validIds.has(rawConfig.dateFieldId) ? rawConfig.dateFieldId : null,
      descriptionFieldId: rawConfig.descriptionFieldId && validIds.has(rawConfig.descriptionFieldId) ? rawConfig.descriptionFieldId : null,
      notesFieldId: rawConfig.notesFieldId && validIds.has(rawConfig.notesFieldId) ? rawConfig.notesFieldId : null,
      personFieldId: rawConfig.personFieldId && validIds.has(rawConfig.personFieldId) ? rawConfig.personFieldId : null,
      storeFieldId: rawConfig.storeFieldId && validIds.has(rawConfig.storeFieldId) ? rawConfig.storeFieldId : null,
      categoryFieldId: rawConfig.categoryFieldId && validIds.has(rawConfig.categoryFieldId) ? rawConfig.categoryFieldId : null,
      itemsFieldId: rawConfig.itemsFieldId && validIds.has(rawConfig.itemsFieldId) ? rawConfig.itemsFieldId : null,
      autoTagIds: Array.isArray(rawConfig.autoTagIds) ? rawConfig.autoTagIds.map((v) => String(v)) : [],
    };

    const fieldConfigs: Record<string, IReceiptFieldConfig> = {};
    for (const field of availableFields) {
      fieldConfigs[field.id] = { mode: 'none', receiptFieldId: null, autoTagIds: [], required: false };
    }

    for (const [columnId, candidate] of Object.entries(rawFieldConfigs)) {
      if (!validIds.has(columnId) || !candidate || typeof candidate !== 'object') continue;
      const mode = RECEIPT_FIELD_MODES.has((candidate as any).mode)
        ? ((candidate as any).mode as ReceiptFieldMode)
        : 'none';
      const receiptFieldId = RECEIPT_SOURCE_FIELD_IDS.has((candidate as any).receiptFieldId)
        ? ((candidate as any).receiptFieldId as ReceiptSourceField)
        : null;
      const autoTagIds = Array.isArray((candidate as any).autoTagIds)
        ? (candidate as any).autoTagIds.map((v: any) => String(v)).filter((id: string) => validTagIds.has(id))
        : [];
      const required = !!(candidate as any).required;
      fieldConfigs[columnId] = { mode, receiptFieldId, autoTagIds, required };
    }

    // Legacy compatibility: convert old mapping config if field is not configured in v2
    const legacyAssignments: Array<{ fieldId?: string | null; source: ReceiptSourceField }> = [
      { fieldId: expenseMapping.amountFieldId, source: 'amount' },
      { fieldId: expenseMapping.dateFieldId, source: 'date' },
      { fieldId: expenseMapping.descriptionFieldId, source: 'description' },
      { fieldId: expenseMapping.notesFieldId, source: 'notes' },
      { fieldId: expenseMapping.personFieldId, source: 'person' },
      { fieldId: expenseMapping.storeFieldId, source: 'store' },
      { fieldId: expenseMapping.categoryFieldId, source: 'category' },
      { fieldId: expenseMapping.itemsFieldId, source: 'items' },
    ];

    for (const assignment of legacyAssignments) {
      if (!assignment.fieldId || !validIds.has(assignment.fieldId)) continue;
      const current = fieldConfigs[assignment.fieldId];
      if (current && current.mode !== 'none') continue;
      fieldConfigs[assignment.fieldId] = {
        mode: 'map',
        receiptFieldId: assignment.source,
        autoTagIds: [],
        required: false,
      };
    }

    if (Array.isArray(expenseMapping.autoTagIds) && expenseMapping.autoTagIds.length > 0) {
      const preferredTagCol = expenseMapping.categoryFieldId
        && availableFields.some((f) => f.id === expenseMapping.categoryFieldId && f.type === 'tag_group')
        ? expenseMapping.categoryFieldId
        : availableFields.find((f) => f.type === 'tag_group')?.id;
      if (preferredTagCol) {
        const current = fieldConfigs[preferredTagCol];
        if (!current || current.mode === 'none') {
          fieldConfigs[preferredTagCol] = {
            mode: 'auto_tags',
            receiptFieldId: null,
            autoTagIds: expenseMapping.autoTagIds.filter((id) => validTagIds.has(id)),
            required: false,
          };
        }
      }
    }

    return {
      expenseMapping,
      availableFields,
      receiptFields: RECEIPT_SOURCE_FIELDS,
      fieldConfigs,
    };
  }

  async updateConfig(
    familyId: string,
    input: Partial<IReceiptExpenseMappingConfig> & { fieldConfigs?: Record<string, Partial<IReceiptFieldConfig>> },
  ): Promise<IReceiptConfigResponse> {
    const current = await this.getConfig(familyId);
    const validIds = new Set(current.availableFields.map((field) => field.id));
    const fieldsById = new Map(current.availableFields.map((field) => [field.id, field]));
    const tags = await this.prisma.tag.findMany({
      where: { tagGroup: { familyId } },
      select: { id: true },
    });
    const validTagIds = new Set(tags.map((tag) => tag.id));
    const normalize = (value?: string | null) => (value && validIds.has(value) ? value : null);
    const normalizeTagIds = (value?: string[]) => {
      if (!Array.isArray(value)) return [];
      return Array.from(new Set(value.map((id) => String(id)).filter((id) => validTagIds.has(id))));
    };

    const nextFieldConfigs: Record<string, IReceiptFieldConfig> = {};
    const inputFieldConfigs = (input.fieldConfigs && typeof input.fieldConfigs === 'object') ? input.fieldConfigs : {};

    for (const field of current.availableFields) {
      const candidate = inputFieldConfigs[field.id] ?? current.fieldConfigs[field.id] ?? { mode: 'none' };
      const mode = RECEIPT_FIELD_MODES.has((candidate as any).mode)
        ? ((candidate as any).mode as ReceiptFieldMode)
        : 'none';
      const receiptFieldId = RECEIPT_SOURCE_FIELD_IDS.has((candidate as any).receiptFieldId)
        ? ((candidate as any).receiptFieldId as ReceiptSourceField)
        : null;
      const autoTagIds = normalizeTagIds((candidate as any).autoTagIds);

      const required = !!(candidate as any).required;
      let normalized: IReceiptFieldConfig = { mode, receiptFieldId, autoTagIds: [], required };

      if (mode === 'map' && receiptFieldId) {
        normalized = { mode, receiptFieldId, autoTagIds: [], required };
      } else if (mode === 'receipt_configurable') {
        normalized = { mode, receiptFieldId: null, autoTagIds: [], required };
      } else if (mode === 'auto_tags' && field.type === 'tag_group') {
        normalized = { mode, receiptFieldId: null, autoTagIds, required };
      } else {
        normalized = { mode: 'none', receiptFieldId: null, autoTagIds: [], required };
      }

      nextFieldConfigs[field.id] = normalized;
    }

    const nextMapping: IReceiptExpenseMappingConfig = {
      amountFieldId: normalize(input.amountFieldId),
      dateFieldId: normalize(input.dateFieldId),
      descriptionFieldId: normalize(input.descriptionFieldId),
      notesFieldId: normalize(input.notesFieldId),
      personFieldId: normalize(input.personFieldId),
      storeFieldId: normalize(input.storeFieldId),
      categoryFieldId: normalize(input.categoryFieldId),
      itemsFieldId: normalize(input.itemsFieldId),
      autoTagIds: normalizeTagIds(input.autoTagIds),
    };

    // Keep legacy shape in sync with v2 field config for backward compatibility.
    for (const [fieldId, cfg] of Object.entries(nextFieldConfigs)) {
      if (cfg.mode !== 'map' || !cfg.receiptFieldId) continue;
      switch (cfg.receiptFieldId) {
        case 'amount': nextMapping.amountFieldId = fieldId; break;
        case 'date': nextMapping.dateFieldId = fieldId; break;
        case 'description': nextMapping.descriptionFieldId = fieldId; break;
        case 'notes': nextMapping.notesFieldId = fieldId; break;
        case 'person': nextMapping.personFieldId = fieldId; break;
        case 'store': nextMapping.storeFieldId = fieldId; break;
        case 'category': nextMapping.categoryFieldId = fieldId; break;
        case 'items': nextMapping.itemsFieldId = fieldId; break;
      }
    }

    const firstAutoTagField = Object.entries(nextFieldConfigs).find(
      ([fieldId, cfg]) => cfg.mode === 'auto_tags' && (fieldsById.get(fieldId)?.type === 'tag_group') && (cfg.autoTagIds?.length ?? 0) > 0,
    );
    nextMapping.autoTagIds = firstAutoTagField ? (firstAutoTagField[1].autoTagIds ?? []) : [];

    const family = await this.prisma.family.findUnique({ where: { id: familyId }, select: { dashboardConfig: true } });
    const existingDashboardConfig = ((family?.dashboardConfig as any) ?? {}) as Record<string, any>;

    // Sync to centralized expenseMappings.receipts.fieldConfigs
    const centralizedConfigs: Record<string, any> = {};
    for (const [columnId, cfg] of Object.entries(nextFieldConfigs)) {
      centralizedConfigs[columnId] = {
        mode: cfg.mode ?? 'none',
        sourceField: cfg.receiptFieldId ?? null,
        autoTagIds: cfg.autoTagIds ?? [],
      };
    }
    const expenseMappings = existingDashboardConfig.expenseMappings ?? {};
    expenseMappings.receipts = { ...(expenseMappings.receipts ?? {}), fieldConfigs: centralizedConfigs };

    await this.prisma.family.update({
      where: { id: familyId },
      data: {
        dashboardConfig: {
          ...existingDashboardConfig,
          receiptExpenseMapping: nextMapping,
          receiptExpenseFieldConfigs: nextFieldConfigs,
          expenseMappings,
        } as any,
      },
    });

    return {
      expenseMapping: nextMapping,
      availableFields: current.availableFields,
      receiptFields: current.receiptFields,
      fieldConfigs: nextFieldConfigs,
    };
  }
  // #endregion

  onModuleInit() {
    this.runImageCleanup();
    setInterval(() => this.runImageCleanup(), 24 * 60 * 60 * 1000);
  }

  private async runImageCleanup() {
    try {
      const result = await this.receiptActions.cleanupExpiredReceipts();
      if (result.cleaned > 0) {
        this.logger.log(`Cleaned up ${result.cleaned} expired receipt(s)`);
      }
    } catch (e) {
      this.logger.error('Failed to clean up expired receipts', e);
    }
  }

  // #region Create
  async createReceipt(familyId: string, userId: string, input: CreateReceiptDto) {
    // Auto-suggest category if none provided
    let categoryId = input.categoryId;
    if (!categoryId && input.description) {
      const suggested = await this.receiptActions.suggestCategory(familyId, input.description);
      if (suggested) categoryId = suggested;
    }

    const receipt = await this.receiptActions.createReceipt({
      familyId,
      userId,
      description: input.description,
      amount: input.amount,
      currency: input.currency,
      date: new Date(input.date),
      categoryId,
      personId: input.personId,
      storeId: input.storeId,
      billId: input.billId,
      imageUrl: input.imageUrl,
      notes: input.notes,
      configurableFields: (input.configurableFields as any) ?? undefined,
      items: input.items,
      tagIds: input.tagIds,
      ocrStatus: input.ocrStatus,
      ocrError: input.ocrError,
      isApproved: input.isApproved,
      approvedAt: input.approvedAt ? new Date(input.approvedAt) : undefined,
    });

    return receipt;
  }

  async duplicateReceipt(id: string, familyId: string, userId: string) {
    const existing = await this.receiptActions.findReceiptById(id, familyId);
    if (!existing) throw new NotFoundException('Receipt not found');

    const receipt = await this.receiptActions.createReceipt({
      familyId,
      userId,
      description: existing.description,
      amount: existing.amount,
      currency: existing.currency,
      date: new Date(),
      categoryId: existing.categoryId,
      personId: existing.personId,
      storeId: existing.storeId,
      billId: existing.billId,
      notes: existing.notes,
      configurableFields: ((existing as any).configurableFields as any) ?? undefined,
      items: existing.items.map((i: any) => ({
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.total,
        categoryId: i.categoryId,
      })),
      tagIds: existing.tags.map((t: any) => t.id),
      ocrStatus: 'COMPLETED',
      isApproved: false,
    });

    return receipt;
  }
  // #endregion

  // #region Read
  async getReceipts(
    familyId: string,
    filters?: { from?: string; to?: string; categoryId?: string; personId?: string; storeId?: string; search?: string },
  ) {
    return this.receiptActions.findReceiptsByFamily(familyId, {
      from: filters?.from ? new Date(filters.from) : undefined,
      to: filters?.to ? new Date(filters.to) : undefined,
      categoryId: filters?.categoryId,
      personId: filters?.personId,
      storeId: filters?.storeId,
      search: filters?.search,
    });
  }

  async getReceipt(id: string, familyId: string) {
    const receipt = await this.receiptActions.findReceiptById(id, familyId);
    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }
    return receipt;
  }

  async getStats(familyId: string, from?: string, to?: string) {
    return this.receiptActions.getReceiptStats(
      familyId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  async checkDuplicate(familyId: string, amount: number, date: string) {
    return this.receiptActions.checkDuplicate(familyId, amount, new Date(date));
  }

  async suggestCategory(familyId: string, description: string) {
    const categoryId = await this.receiptActions.suggestCategory(familyId, description);
    return { categoryId };
  }

  async extractPdfText(_familyId: string, dataUrl: string) {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:application/pdf')) {
      throw new BadRequestException('Invalid PDF data URL');
    }
    const diagnostics: string[] = [];
    const normalizeText = (value?: string) => (value ?? '').replace(/\u0000/g, '').trim();
    const errorToMessage = (error: unknown) => {
      if (error instanceof Error && error.message) return error.message;
      if (typeof error === 'string') return error;
      try { return JSON.stringify(error); } catch { return 'unknown'; }
    };

    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex < 0) throw new BadRequestException('Invalid PDF data URL payload');

    const header = dataUrl.slice(0, commaIndex);
    const rawPayload = dataUrl.slice(commaIndex + 1);
    const payload = rawPayload.replace(/\s/g, '');
    const isBase64 = /;base64/i.test(header);

    let buffer: Buffer;
    if (isBase64) {
      const normalizedBase64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalizedBase64.padEnd(Math.ceil(normalizedBase64.length / 4) * 4, '=');
      buffer = Buffer.from(padded, 'base64');
    } else {
      buffer = Buffer.from(decodeURIComponent(payload), 'utf-8');
    }

    diagnostics.push(`input:header:${header}`);
    diagnostics.push(`input:isBase64:${isBase64}`);
    diagnostics.push(`input:payloadLen:${payload.length}`);
    diagnostics.push(`input:bufferLen:${buffer.length}`);

    if (buffer.length === 0) {
      return { text: '', hasText: false, length: 0, source: 'none', diagnostics: [...diagnostics, 'input:error:empty-buffer'] };
    }

    const baseBytes = Uint8Array.from(buffer);
    const getFreshBytes = () => Uint8Array.from(baseBytes);
    const getFreshBuffer = () => Buffer.from(baseBytes);

    const makeResult = async (text: string, source: string) => {
      let parsed: IParsedReceipt | null = null;
      try {
        parsed = await this.parseReceiptWithAI(text);
        if (parsed) diagnostics.push('ai:parsed:ok');
        else diagnostics.push('ai:parsed:no-key');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const short = msg.includes('429') ? '429-quota-exceeded' : msg.slice(0, 120);
        diagnostics.push(`ai:parsed:error:${short}`);
      }
      return { text, hasText: true, length: text.length, source, diagnostics, parsed };
    };

    // Resolve cMaps and standard fonts from pdfjs-dist package
    let cMapDir = '';
    let standardFontDir = '';
    try {
      const pdfjsDir = path.dirname(require.resolve('pdfjs-dist/package.json'));
      cMapDir = path.join(pdfjsDir, 'cmaps');
      standardFontDir = path.join(pdfjsDir, 'standard_fonts');
      diagnostics.push(`cmap:dir:${fs.existsSync(cMapDir) ? 'exists' : 'missing'}`);
    } catch {
      diagnostics.push('cmap:resolve:failed');
    }

    // Node.js CMap reader (fetch() doesn't support file://)
    class NodeCMapReaderFactory {
      async fetch({ name }: { name: string }) {
        const bcmapPath = path.join(cMapDir, `${name}.bcmap`);
        if (fs.existsSync(bcmapPath)) {
          return { cMapData: new Uint8Array(fs.readFileSync(bcmapPath)), isCompressed: true };
        }
        return { cMapData: new Uint8Array(fs.readFileSync(path.join(cMapDir, `${name}.cmap`))), isCompressed: false };
      }
    }

    class NodeStandardFontDataFactory {
      async fetch({ filename }: { filename: string }) {
        return new Uint8Array(fs.readFileSync(path.join(standardFontDir, filename)));
      }
    }

    // Engine 1: pdfjs-dist with cMaps
    try {
      diagnostics.push('engine:pdfjs:start');
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const docOptions: any = {
        data: getFreshBytes(),
        disableWorker: true,
        disableFontFace: true,
        useSystemFonts: true,
      };
      if (cMapDir && fs.existsSync(cMapDir)) {
        docOptions.CMapReaderFactory = NodeCMapReaderFactory;
        docOptions.cMapPacked = true;
      }
      if (standardFontDir && fs.existsSync(standardFontDir)) {
        docOptions.StandardFontDataFactory = NodeStandardFontDataFactory;
      }

      const doc = await (pdfjs as any).getDocument(docOptions).promise;
      diagnostics.push(`engine:pdfjs:pages:${doc.numPages}`);
      const pages: string[] = [];

      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent({ includeMarkedContent: true } as any);
        const items = content.items as any[];
        const nonEmpty = items.filter((it: any) => String(it?.str ?? '').trim().length > 0);
        diagnostics.push(`engine:pdfjs:p${p}:items:${items.length}:text:${nonEmpty.length}`);
        const lines = nonEmpty.map((it: any) => String(it.str).trim());
        if (lines.length > 0) pages.push(lines.join('\n'));
      }

      const text = normalizeText(pages.join('\n\n'));
      if (text.length > 0) {
        diagnostics.push(`engine:pdfjs:ok:${text.length}`);
        return makeResult(text, 'pdfjs');
      }
      diagnostics.push('engine:pdfjs:empty');
    } catch (error) {
      diagnostics.push(`engine:pdfjs:error:${errorToMessage(error)}`);
    }

    // Engine 2: pdf-parse (uses its own bundled pdfjs — do NOT pass our factories)
    try {
      diagnostics.push('engine:pdf-parse:start');
      const pdfParseModule = await import('pdf-parse');
      const PDFParse = (pdfParseModule as any).PDFParse;

      if (typeof PDFParse === 'function') {
        const parser = new PDFParse({ data: getFreshBytes(), disableWorker: true });
        const result = await parser.getText();
        const text = normalizeText(result?.text ?? '');
        diagnostics.push(`engine:pdf-parse:pages:${result?.totalPages ?? '?'}`);

        if (text.length > 0) {
          diagnostics.push(`engine:pdf-parse:ok:${text.length}`);
          return makeResult(text, 'pdf-parse');
        }
        diagnostics.push('engine:pdf-parse:empty');
      } else {
        diagnostics.push('engine:pdf-parse:no-PDFParse-class');
      }
    } catch (error) {
      diagnostics.push(`engine:pdf-parse:error:${errorToMessage(error)}`);
    }

    // Engine 3: pdf2json
    try {
      diagnostics.push('engine:pdf2json:start');
      const PDFParserModule = await import('pdf2json');
      const PDFParserCtor = (PDFParserModule as any).default ?? (PDFParserModule as any);
      const binary = getFreshBuffer();

      const text = await new Promise<string>((resolve, reject) => {
        const parser = new PDFParserCtor();
        parser.on('pdfParser_dataError', (errData: any) => {
          reject(new Error(errData?.parserError?.toString?.() ?? 'pdf2json error'));
        });
        parser.on('pdfParser_dataReady', () => {
          try { resolve(normalizeText(String(parser.getRawTextContent?.() ?? ''))); }
          catch (e) { reject(e as Error); }
        });
        parser.parseBuffer(binary);
      });

      if (text.length > 0) {
        diagnostics.push(`engine:pdf2json:ok:${text.length}`);
        return makeResult(text, 'pdf2json');
      }
      diagnostics.push('engine:pdf2json:empty');
    } catch (error) {
      diagnostics.push(`engine:pdf2json:error:${errorToMessage(error)}`);
    }

    // Engine 4: pdfreader
    try {
      diagnostics.push('engine:pdfreader:start');
      const mod = await import('pdfreader');
      const PdfReader = (mod as any).PdfReader ?? (mod as any).default?.PdfReader ?? (mod as any).default;

      if (typeof PdfReader !== 'function') {
        diagnostics.push('engine:pdfreader:error:no-constructor');
      } else {
        const text = await new Promise<string>((resolve, reject) => {
          const chunks: string[] = [];
          new PdfReader().parseBuffer(getFreshBuffer(), (err: any, item: any) => {
            if (err) { reject(err); return; }
            if (!item) { resolve(chunks.join('\n')); return; }
            if (typeof item.text === 'string' && item.text.trim().length > 0) chunks.push(item.text.trim());
          });
        });
        const normalized = normalizeText(text);
        if (normalized.length > 0) {
          diagnostics.push(`engine:pdfreader:ok:${normalized.length}`);
          return makeResult(normalized, 'pdfreader');
        }
        diagnostics.push('engine:pdfreader:empty');
      }
    } catch (error) {
      diagnostics.push(`engine:pdfreader:error:${errorToMessage(error)}`);
    }

    // Engine 5: Server-side render PDF to image + Tesseract OCR
    try {
      diagnostics.push('engine:render-ocr:start');

      // Render PDF first page to PNG using pdfjs + @napi-rs/canvas (Node native canvas)
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const { createCanvas } = await import('@napi-rs/canvas');

      const docOptions: any = { data: getFreshBytes(), disableWorker: true };
      if (cMapDir && fs.existsSync(cMapDir)) {
        docOptions.CMapReaderFactory = NodeCMapReaderFactory;
        docOptions.cMapPacked = true;
      }
      if (standardFontDir && fs.existsSync(standardFontDir)) {
        docOptions.StandardFontDataFactory = NodeStandardFontDataFactory;
      }

      const doc = await (pdfjs as any).getDocument(docOptions).promise;
      const page = await doc.getPage(1);
      const scale = 3;
      const viewport = page.getViewport({ scale });

      const canvasWidth = Math.floor(viewport.width);
      const canvasHeight = Math.floor(viewport.height);
      diagnostics.push(`engine:render-ocr:canvas:${canvasWidth}x${canvasHeight}`);

      const canvas = createCanvas(canvasWidth, canvasHeight);
      const ctx = canvas.getContext('2d');

      // pdfjs render expects a CanvasRenderingContext2D-like object
      await page.render({ canvasContext: ctx as any, viewport }).promise;
      diagnostics.push('engine:render-ocr:rendered');

      // Preprocess: convert to grayscale + increase contrast for better OCR
      const imgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        // Grayscale using luminance weights
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        // Increase contrast: stretch toward black/white
        const contrast = gray < 128 ? Math.max(0, gray * 0.6) : Math.min(255, gray * 1.2 + 30);
        const v = Math.round(contrast);
        data[i] = v; data[i + 1] = v; data[i + 2] = v;
      }
      ctx.putImageData(imgData, 0, 0);

      const pngBuffer = canvas.toBuffer('image/png');
      diagnostics.push(`engine:render-ocr:pngSize:${pngBuffer.length}`);

      if (pngBuffer.length < 1000) {
        diagnostics.push('engine:render-ocr:png-too-small');
      } else {
        // Run Tesseract OCR on the rendered image
        diagnostics.push('engine:render-ocr:tesseract:start');
        const { createWorker, PSM } = await import('tesseract.js');
        const worker = await createWorker('pol+eng');
        try {
          await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
          const { data: { text: ocrText } } = await worker.recognize(pngBuffer);
          const normalized = normalizeText(ocrText);
          diagnostics.push(`engine:render-ocr:tesseract:ok:${normalized.length}`);

          if (normalized.length > 0) {
            return makeResult(normalized, 'render-ocr');
          }
          diagnostics.push('engine:render-ocr:tesseract:empty');
        } finally {
          await worker.terminate();
        }
      }
    } catch (error) {
      diagnostics.push(`engine:render-ocr:error:${errorToMessage(error)}`);
    }

    this.logger.warn(`PDF text extraction failed all engines: ${diagnostics.join(' | ')}`);
    return { text: '', hasText: false, length: 0, source: 'none', diagnostics, parsed: null };
  }
  // #endregion

  // #region Update
  async updateReceipt(id: string, familyId: string, input: UpdateReceiptDto) {
    const existing = await this.receiptActions.findReceiptById(id, familyId);
    if (!existing) throw new NotFoundException('Receipt not found');

    return this.receiptActions.updateReceipt(id, familyId, {
      description: input.description,
      amount: input.amount,
      currency: input.currency,
      date: input.date ? new Date(input.date) : undefined,
      categoryId: input.categoryId,
      personId: input.personId,
      storeId: input.storeId,
      billId: input.billId,
      imageUrl: input.imageUrl,
      notes: input.notes,
      items: input.items,
      tagIds: input.tagIds,
      ocrStatus: input.ocrStatus,
      ocrError: input.ocrError,
      isApproved: input.isApproved,
      approvedAt: input.approvedAt ? new Date(input.approvedAt) : undefined,
    });
  }
  // #endregion

  // #region Delete
  async deleteReceipt(id: string, familyId: string) {
    const existing = await this.receiptActions.findReceiptById(id, familyId);
    if (!existing) throw new NotFoundException('Receipt not found');

    await this.receiptActions.deleteReceipt(id, familyId);
  }
  // #endregion

  // #region AI Parsing
  async parseReceiptAI(text: string): Promise<{ parsed: IParsedReceipt | null }> {
    const parsed = await this.parseReceiptWithAI(text);
    return { parsed };
  }
  // #endregion

  // #region Misc
  async createExpenseFromReceipt(id: string, familyId: string) {
    const receipt = await this.receiptActions.findReceiptById(id, familyId);
    if (!receipt) throw new NotFoundException('Receipt not found');

    if ((receipt as any).ocrStatus === 'PENDING') {
      throw new BadRequestException('Paragon jest jeszcze przetwarzany. Poczekaj na zakończenie OCR.');
    }

    if ((receipt as any).isApproved) {
      throw new BadRequestException('Paragon został już zatwierdzony.');
    }

    if (Number((receipt as any).amount ?? 0) <= 0) {
      throw new BadRequestException('Uzupełnij kwotę paragonu przed zatwierdzeniem.');
    }

    await this._autoCreateExpense(familyId, receipt);
    await this.receiptActions.updateReceipt(id, familyId, {
      isApproved: true,
      approvedAt: new Date(),
    });

    return { message: 'Receipt approved and expense created' };
  }
  // #endregion
}
