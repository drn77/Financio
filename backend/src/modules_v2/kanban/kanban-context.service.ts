import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { MoveKanbanCardDto } from './dto/move-kanban-card.dto';
import { KanbanObjectType, UpdateKanbanConfigDto } from './dto/update-kanban-config.dto';

export interface IKanbanColumn {
  id: string;
  name: string;
  tagId: string;
  objectTypes: KanbanObjectType[];
}

export interface IKanbanConfig {
  columns: IKanbanColumn[];
}

interface ITemplateColumnLike {
  id: string;
  type?: string;
  colorFieldByTag?: string;
  colorRowByTag?: boolean;
}

@Injectable()
export class KanbanContextService {
  constructor(private readonly prisma: PrismaService) {}

  private _defaultConfig(): IKanbanConfig {
    return { columns: [] };
  }

  private _normalizeConfig(input: any): IKanbanConfig {
    const columns = Array.isArray(input?.columns) ? input.columns : [];
    const normalizedColumns: IKanbanColumn[] = columns
      .filter((c: any) => c && typeof c.id === 'string' && typeof c.name === 'string' && typeof c.tagId === 'string')
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        tagId: c.tagId,
        objectTypes: Array.isArray(c.objectTypes) ? c.objectTypes.filter((t: any) => ['bill', 'expense', 'fixed-expense', 'receipt'].includes(t)) : [],
      }))
      .filter((c: IKanbanColumn) => c.objectTypes.length > 0);

    return { columns: normalizedColumns };
  }

  private async _tagIdToNameMap(familyId: string): Promise<Record<string, string>> {
    const tags = await this.prisma.tag.findMany({
      where: { tagGroup: { familyId } },
      select: { id: true, name: true },
    });

    const map: Record<string, string> = {};
    for (const tag of tags) map[tag.id] = tag.name;
    return map;
  }

  private _hasTagName(data: Record<string, any>, tagGroupColumnIds: string[], tagName: string): boolean {
    for (const colId of tagGroupColumnIds) {
      const value = data[colId];
      const selected = Array.isArray(value) ? value : value ? [value] : [];
      if (selected.includes(tagName)) return true;
    }
    return false;
  }

  private _buildTagColorByNameMap(tags: { name: string; color: string }[]): Record<string, string> {
    const map: Record<string, string> = {};
    for (const tag of tags) {
      map[tag.name] = tag.color || '#888';
    }
    return map;
  }

  private _buildTagColorByIdMap(tags: { id: string; color: string }[]): Record<string, string> {
    const map: Record<string, string> = {};
    for (const tag of tags) {
      map[tag.id] = tag.color || '#888';
    }
    return map;
  }

  private _firstTagColorHex(tagNames: string[], tagColorByName: Record<string, string>): string | undefined {
    if (!tagNames.length) return undefined;
    const color = tagColorByName[tagNames[0]];
    if (!color || color === '#888') return undefined;
    return color;
  }

  private _readTagNames(data: Record<string, any>, columnId?: string): string[] {
    if (!columnId) return [];
    const value = data[columnId];
    return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [];
  }

  private _resolveExpenseColoring(
    data: Record<string, any>,
    templateColumns: ITemplateColumnLike[],
    tagColorByName: Record<string, string>,
    fallbackColorHex?: string,
  ): { cardBgColor?: string; amountBgColor?: string } {
    const rowColorCol = templateColumns.find((c) => c.colorRowByTag);
    const rowColorHex = this._firstTagColorHex(this._readTagNames(data, rowColorCol?.id), tagColorByName);

    const currencyCol = templateColumns.find((c) => c.id === 'col_amount' && c.type === 'currency')
      ?? templateColumns.find((c) => c.type === 'currency');
    const amountColorHex = this._firstTagColorHex(this._readTagNames(data, currencyCol?.colorFieldByTag), tagColorByName);

    return {
      cardBgColor: rowColorHex ? `${rowColorHex}15` : fallbackColorHex ? `${fallbackColorHex}15` : undefined,
      amountBgColor: amountColorHex ? `${amountColorHex}20` : undefined,
    };
  }

  async getConfig(familyId: string): Promise<IKanbanConfig> {
    const family = await (this.prisma.family.findUnique as any)({ where: { id: familyId }, select: { kanbanConfig: true } });
    return this._normalizeConfig((family as any)?.kanbanConfig ?? this._defaultConfig());
  }

  async updateConfig(familyId: string, input: UpdateKanbanConfigDto): Promise<IKanbanConfig> {
    const next = this._normalizeConfig(input);
    await (this.prisma.family.update as any)({
      where: { id: familyId },
      data: { kanbanConfig: next as any },
    });
    return next;
  }

  async getBoard(familyId: string) {
    const config = await this.getConfig(familyId);
    const tagIdToName = await this._tagIdToNameMap(familyId);
    const tags = await this.prisma.tag.findMany({
      where: { tagGroup: { familyId } },
      select: { id: true, name: true, color: true },
    });
    const tagColorByName = this._buildTagColorByNameMap(tags as any);
    const tagColorById = this._buildTagColorByIdMap(tags as any);

    const defaultTemplate = await this.prisma.template.findFirst({
      where: { familyId, isDefault: true },
      select: {
        id: true,
        columns: true,
        records: {
          orderBy: { createdAt: 'desc' },
          take: 2000,
          select: { id: true, data: true, createdAt: true },
        },
      },
    });

    const templateColumns = ((defaultTemplate?.columns as unknown as ITemplateColumnLike[]) ?? []);

    const tagGroupColumnIds = (templateColumns as any[])
      .filter((c: any) => c?.type === 'tag_group' && typeof c?.id === 'string')
      .map((c: any) => c.id);

    const bills = await this.prisma.bill.findMany({
      where: { familyId, isActive: true },
      include: {
        tags: { select: { tagId: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });

    const receipts = await this.prisma.receipt.findMany({
      where: { familyId },
      include: {
        tags: { select: { tagId: true } },
      },
      orderBy: { date: 'desc' },
      take: 500,
    });

    const fixedExpenses = await this.prisma.fixedExpense.findMany({
      where: { familyId, isActive: true },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });

    const columns = config.columns.map((col) => {
      const tagName = tagIdToName[col.tagId];
      const columnTagColorHex = tagColorById[col.tagId] && tagColorById[col.tagId] !== '#888' ? tagColorById[col.tagId] : undefined;
      const cards: any[] = [];

      if (col.objectTypes.includes('bill')) {
        for (const bill of bills) {
          const tagIds = bill.tags.map((x: any) => x.tagId);
          if (tagIds.includes(col.tagId)) {
            cards.push({
              id: `bill:${bill.id}`,
              objectType: 'bill',
              objectId: bill.id,
              title: bill.name,
              amount: Number(bill.amount),
              currency: bill.currency,
              meta: `Termin: ${bill.dueDay}. dzień miesiąca`,
              cardBgColor: columnTagColorHex ? `${columnTagColorHex}15` : undefined,
              amountBgColor: columnTagColorHex ? `${columnTagColorHex}20` : undefined,
            });
          }
        }
      }

      if (col.objectTypes.includes('receipt')) {
        for (const receipt of receipts) {
          const tagIds = receipt.tags.map((x: any) => x.tagId);
          if (tagIds.includes(col.tagId)) {
            cards.push({
              id: `receipt:${receipt.id}`,
              objectType: 'receipt',
              objectId: receipt.id,
              title: receipt.description,
              amount: Number(receipt.amount),
              currency: receipt.currency,
              meta: new Date(receipt.date).toLocaleDateString('pl-PL'),
              cardBgColor: columnTagColorHex ? `${columnTagColorHex}15` : undefined,
              amountBgColor: columnTagColorHex ? `${columnTagColorHex}20` : undefined,
            });
          }
        }
      }

      if (col.objectTypes.includes('fixed-expense')) {
        for (const fixed of fixedExpenses) {
          if (fixed.paymentTagId === col.tagId) {
            cards.push({
              id: `fixed-expense:${fixed.id}`,
              objectType: 'fixed-expense',
              objectId: fixed.id,
              title: fixed.name,
              amount: Number(fixed.amount),
              currency: fixed.currency,
              meta: fixed.nextDueDate ? `Najbliższa: ${new Date(fixed.nextDueDate).toLocaleDateString('pl-PL')}` : 'Stały wydatek',
              cardBgColor: columnTagColorHex ? `${columnTagColorHex}15` : undefined,
              amountBgColor: columnTagColorHex ? `${columnTagColorHex}20` : undefined,
            });
          }
        }
      }

      if (col.objectTypes.includes('expense') && defaultTemplate && tagName) {
        for (const record of defaultTemplate.records) {
          const data = (record.data as Record<string, any>) ?? {};
          if (this._hasTagName(data, tagGroupColumnIds, tagName)) {
            const amountField = data?.col_amount;
            const amount = typeof amountField === 'object' && amountField?.amount != null
              ? Number(amountField.amount)
              : typeof amountField === 'number'
                ? amountField
                : 0;

            const coloring = this._resolveExpenseColoring(data, templateColumns, tagColorByName, columnTagColorHex);

            cards.push({
              id: `expense:${record.id}`,
              objectType: 'expense',
              objectId: record.id,
              title: data?.col_description || data?.col_name || 'Wydatek',
              amount,
              currency: amountField?.currency || 'PLN',
              meta: data?.col_date || new Date(record.createdAt).toLocaleDateString('pl-PL'),
              cardBgColor: coloring.cardBgColor,
              amountBgColor: coloring.amountBgColor,
            });
          }
        }
      }

      return {
        ...col,
        tagName: tagName ?? null,
        cards,
      };
    });

    return { columns };
  }

  async moveCard(familyId: string, input: MoveKanbanCardDto) {
    const { objectType, objectId, fromTagId, toTagId } = input;

    if (objectType === 'bill') {
      const bill = await this.prisma.bill.findFirst({
        where: { id: objectId, familyId },
        include: { tags: { select: { tagId: true } } },
      });

      if (!bill) throw new NotFoundException('Bill not found');

      const nextTagIds = new Set(bill.tags.map((t: any) => t.tagId));
      if (fromTagId) nextTagIds.delete(fromTagId);
      nextTagIds.add(toTagId);

      await this.prisma.billTag.deleteMany({ where: { billId: objectId } });
      await this.prisma.billTag.createMany({
        data: Array.from(nextTagIds).map((tagId) => ({ billId: objectId, tagId })),
      });

      return { message: 'Bill moved successfully' };
    }

    if (objectType === 'receipt') {
      const receipt = await this.prisma.receipt.findFirst({
        where: { id: objectId, familyId },
        include: { tags: { select: { tagId: true } } },
      });

      if (!receipt) throw new NotFoundException('Receipt not found');

      const nextTagIds = new Set(receipt.tags.map((t: any) => t.tagId));
      if (fromTagId) nextTagIds.delete(fromTagId);
      nextTagIds.add(toTagId);

      await this.prisma.receiptTag.deleteMany({ where: { receiptId: objectId } });
      await this.prisma.receiptTag.createMany({
        data: Array.from(nextTagIds).map((tagId) => ({ receiptId: objectId, tagId })),
      });

      return { message: 'Receipt moved successfully' };
    }

    if (objectType === 'fixed-expense') {
      const fixed = await this.prisma.fixedExpense.findFirst({ where: { id: objectId, familyId } });
      if (!fixed) throw new NotFoundException('Fixed expense not found');

      await this.prisma.fixedExpense.update({
        where: { id: objectId },
        data: { paymentTagId: toTagId },
      });

      return { message: 'Fixed expense moved successfully' };
    }

    if (objectType === 'expense') {
      const defaultTemplate = await this.prisma.template.findFirst({
        where: { familyId, isDefault: true },
        select: { id: true, columns: true },
      });
      if (!defaultTemplate) throw new NotFoundException('Default template not found');

      const record = await this.prisma.templateRecord.findFirst({
        where: { id: objectId, templateId: defaultTemplate.id },
        select: { id: true, data: true },
      });
      if (!record) throw new NotFoundException('Expense record not found');

      const tagNameMap = await this._tagIdToNameMap(familyId);
      const fromTagName = fromTagId ? tagNameMap[fromTagId] : undefined;
      const toTagName = tagNameMap[toTagId];
      if (!toTagName) throw new NotFoundException('Target tag not found');

      const tagGroupColumnIds = ((defaultTemplate.columns as any[]) ?? [])
        .filter((c: any) => c?.type === 'tag_group' && typeof c?.id === 'string')
        .map((c: any) => c.id);

      if (tagGroupColumnIds.length === 0) {
        throw new NotFoundException('Default template has no tag columns');
      }

      const data = ((record.data as Record<string, any>) ?? {}) as Record<string, any>;

      let targetColumnId: string | undefined;
      for (const colId of tagGroupColumnIds) {
        const value = data[colId];
        const selected = Array.isArray(value) ? value : value ? [value] : [];
        if (fromTagName && selected.includes(fromTagName)) {
          targetColumnId = colId;
          break;
        }
      }

      if (!targetColumnId) {
        targetColumnId = tagGroupColumnIds[0];
      }

      if (!targetColumnId) {
        throw new NotFoundException('No target tag column found');
      }

      const prevValue = data[targetColumnId];
      const selected = Array.isArray(prevValue) ? [...prevValue] : prevValue ? [prevValue] : [];
      const filtered = fromTagName ? selected.filter((x) => x !== fromTagName) : selected;
      if (!filtered.includes(toTagName)) filtered.push(toTagName);

      data[targetColumnId] = Array.isArray(prevValue) ? filtered : filtered[0] ?? toTagName;

      await this.prisma.templateRecord.update({
        where: { id: objectId },
        data: { data: data as any },
      });

      return { message: 'Expense moved successfully' };
    }

    throw new NotFoundException('Unsupported object type');
  }

  async getCardDetails(familyId: string, objectType: KanbanObjectType, objectId: string) {
    if (objectType === 'bill') {
      const bill = await this.prisma.bill.findFirst({ where: { id: objectId, familyId } });
      if (!bill) throw new NotFoundException('Bill not found');
      return {
        objectType,
        objectId,
        data: {
          id: bill.id,
          name: bill.name,
          amount: Number(bill.amount),
          dueDay: bill.dueDay,
          notes: bill.notes ?? '',
        },
      };
    }

    if (objectType === 'fixed-expense') {
      const fixed = await this.prisma.fixedExpense.findFirst({ where: { id: objectId, familyId } });
      if (!fixed) throw new NotFoundException('Fixed expense not found');
      return {
        objectType,
        objectId,
        data: {
          id: fixed.id,
          name: fixed.name,
          amount: Number(fixed.amount),
          nextDueDate: fixed.nextDueDate ? new Date(fixed.nextDueDate).toISOString().split('T')[0] : '',
          notes: fixed.notes ?? '',
        },
      };
    }

    if (objectType === 'receipt') {
      const receipt = await this.prisma.receipt.findFirst({ where: { id: objectId, familyId } });
      if (!receipt) throw new NotFoundException('Receipt not found');
      return {
        objectType,
        objectId,
        data: {
          id: receipt.id,
          description: receipt.description,
          amount: Number(receipt.amount),
          date: new Date(receipt.date).toISOString().split('T')[0],
          notes: receipt.notes ?? '',
        },
      };
    }

    const defaultTemplate = await this.prisma.template.findFirst({ where: { familyId, isDefault: true }, select: { id: true } });
    if (!defaultTemplate) throw new NotFoundException('Default template not found');

    const record = await this.prisma.templateRecord.findFirst({ where: { id: objectId, templateId: defaultTemplate.id } });
    if (!record) throw new NotFoundException('Expense record not found');

    const data = (record.data as Record<string, any>) ?? {};
    const amountField = data.col_amount;
    const amount = typeof amountField === 'object' && amountField?.amount != null
      ? Number(amountField.amount)
      : typeof amountField === 'number'
        ? amountField
        : 0;

    return {
      objectType,
      objectId,
      data: {
        id: record.id,
        title: data.col_description || data.col_name || 'Wydatek',
        amount,
        date: data.col_date || new Date(record.createdAt).toISOString().split('T')[0],
      },
    };
  }

  async updateCard(
    familyId: string,
    objectType: KanbanObjectType,
    objectId: string,
    patch: Record<string, unknown>,
  ) {
    if (objectType === 'bill') {
      const bill = await this.prisma.bill.findFirst({ where: { id: objectId, familyId } });
      if (!bill) throw new NotFoundException('Bill not found');

      await this.prisma.bill.update({
        where: { id: objectId },
        data: {
          ...(patch.name !== undefined ? { name: String(patch.name) } : {}),
          ...(patch.amount !== undefined ? { amount: Number(patch.amount) } : {}),
          ...(patch.dueDay !== undefined ? { dueDay: Number(patch.dueDay) } : {}),
          ...(patch.notes !== undefined ? { notes: String(patch.notes || '') } : {}),
        },
      });
      return { message: 'Bill updated successfully' };
    }

    if (objectType === 'fixed-expense') {
      const fixed = await this.prisma.fixedExpense.findFirst({ where: { id: objectId, familyId } });
      if (!fixed) throw new NotFoundException('Fixed expense not found');

      await this.prisma.fixedExpense.update({
        where: { id: objectId },
        data: {
          ...(patch.name !== undefined ? { name: String(patch.name) } : {}),
          ...(patch.amount !== undefined ? { amount: Number(patch.amount) } : {}),
          ...(patch.nextDueDate !== undefined && patch.nextDueDate ? { nextDueDate: new Date(String(patch.nextDueDate)) } : {}),
          ...(patch.notes !== undefined ? { notes: String(patch.notes || '') } : {}),
        },
      });
      return { message: 'Fixed expense updated successfully' };
    }

    if (objectType === 'receipt') {
      const receipt = await this.prisma.receipt.findFirst({ where: { id: objectId, familyId } });
      if (!receipt) throw new NotFoundException('Receipt not found');

      await this.prisma.receipt.update({
        where: { id: objectId },
        data: {
          ...(patch.description !== undefined ? { description: String(patch.description) } : {}),
          ...(patch.amount !== undefined ? { amount: Number(patch.amount) } : {}),
          ...(patch.date !== undefined && patch.date ? { date: new Date(String(patch.date)) } : {}),
          ...(patch.notes !== undefined ? { notes: String(patch.notes || '') } : {}),
        },
      });
      return { message: 'Receipt updated successfully' };
    }

    const defaultTemplate = await this.prisma.template.findFirst({ where: { familyId, isDefault: true }, select: { id: true } });
    if (!defaultTemplate) throw new NotFoundException('Default template not found');

    const record = await this.prisma.templateRecord.findFirst({ where: { id: objectId, templateId: defaultTemplate.id } });
    if (!record) throw new NotFoundException('Expense record not found');

    const data = ((record.data as Record<string, any>) ?? {}) as Record<string, any>;
    if (patch.title !== undefined) {
      data.col_description = String(patch.title);
    }
    if (patch.amount !== undefined) {
      data.col_amount = { amount: Number(patch.amount), currency: (data.col_amount?.currency ?? 'PLN') };
    }
    if (patch.date !== undefined && patch.date) {
      data.col_date = String(patch.date);
    }

    await this.prisma.templateRecord.update({
      where: { id: objectId },
      data: { data: data as any },
    });

    return { message: 'Expense updated successfully' };
  }
}
