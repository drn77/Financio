import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

const RECEIPT_INCLUDE = {
  items: true,
  tags: {
    include: {
      tag: {
        include: {
          tagGroup: { select: { name: true } },
        },
      },
    },
  },
};

@Injectable()
export class ReceiptActionsService {
  constructor(private readonly prisma: PrismaService) {}

  // #region Private
  private _mapReceipt(receipt: any) {
    return {
      ...receipt,
      amount: Number(receipt.amount),
      items: (receipt.items ?? []).map((item: any) => ({
        ...item,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
      })),
      tags: (receipt.tags ?? []).map((rt: any) => ({
        id: rt.tag.id,
        name: rt.tag.name,
        color: rt.tag.color,
        icon: rt.tag.icon,
        groupName: rt.tag.tagGroup?.name ?? null,
      })),
    };
  }
  // #endregion

  // #region Create
  async createReceipt(input: {
    familyId: string;
    userId: string;
    description: string;
    amount: number;
    currency?: string;
    date: Date;
    categoryId?: string;
    personId?: string;
    storeId?: string;
    billId?: string;
    imageUrl?: string;
    notes?: string;
    items?: { name: string; quantity?: number; unitPrice: number; total: number; categoryId?: string }[];
    tagIds?: string[];
  }) {
    const receipt = await this.prisma.receipt.create({
      data: {
        family: { connect: { id: input.familyId } },
        user: { connect: { id: input.userId } },
        description: input.description,
        amount: input.amount,
        currency: input.currency,
        date: input.date,
        categoryId: input.categoryId,
        personId: input.personId,
        store: input.storeId ? { connect: { id: input.storeId } } : undefined,
        billId: input.billId,
        imageUrl: input.imageUrl,
        notes: input.notes,
        items: input.items && input.items.length > 0 ? {
          create: input.items.map((item) => ({
            name: item.name,
            quantity: item.quantity ?? 1,
            unitPrice: item.unitPrice,
            total: item.total,
            categoryId: item.categoryId,
          })),
        } : undefined,
        tags: input.tagIds && input.tagIds.length > 0 ? {
          create: input.tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })),
        } : undefined,
      },
      include: RECEIPT_INCLUDE,
    });

    return this._mapReceipt(receipt);
  }
  // #endregion

  // #region Read
  async findReceiptsByFamily(
    familyId: string,
    filters?: { from?: Date; to?: Date; categoryId?: string; personId?: string; storeId?: string; search?: string },
  ) {
    const where: any = { familyId };

    if (filters?.from || filters?.to) {
      where.date = {};
      if (filters.from) where.date.gte = filters.from;
      if (filters.to) where.date.lte = filters.to;
    }

    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.personId) where.personId = filters.personId;
    if (filters?.storeId) where.storeId = filters.storeId;

    if (filters?.search) {
      where.OR = [
        { description: { contains: filters.search, mode: 'insensitive' } },
        { notes: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const receipts = await this.prisma.receipt.findMany({
      where,
      include: RECEIPT_INCLUDE,
      orderBy: { date: 'desc' },
    });

    return receipts.map((r: any) => this._mapReceipt(r));
  }

  async findReceiptById(id: string, familyId: string) {
    const receipt = await this.prisma.receipt.findFirst({
      where: { id, familyId },
      include: RECEIPT_INCLUDE,
    });

    return receipt ? this._mapReceipt(receipt) : null;
  }

  async getReceiptStats(familyId: string, from?: Date, to?: Date) {
    const where: any = { familyId };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = from;
      if (to) where.date.lte = to;
    }

    const receipts = await this.prisma.receipt.findMany({
      where,
      include: { items: true, store: { select: { name: true } } },
    });

    const totalAmount = receipts.reduce((s: number, r: any) => s + Number(r.amount), 0);
    const categoryMap = new Map<string, { amount: number; count: number }>();
    const storeMap = new Map<string, { amount: number; count: number }>();
    const itemMap = new Map<string, { totalSpent: number; count: number }>();

    for (const r of receipts) {
      const amount = Number(r.amount);
      const catId = r.categoryId ?? 'Brak kategorii';
      const existing = categoryMap.get(catId) ?? { amount: 0, count: 0 };
      categoryMap.set(catId, { amount: existing.amount + amount, count: existing.count + 1 });

      const storeName = (r as any).store?.name ?? 'Nieznany';
      const storeExisting = storeMap.get(storeName) ?? { amount: 0, count: 0 };
      storeMap.set(storeName, { amount: storeExisting.amount + amount, count: storeExisting.count + 1 });

      for (const item of (r as any).items ?? []) {
        const itemName = item.name.toLowerCase().trim();
        const ie = itemMap.get(itemName) ?? { totalSpent: 0, count: 0 };
        itemMap.set(itemName, { totalSpent: ie.totalSpent + Number(item.total), count: ie.count + 1 });
      }
    }

    return {
      totalReceipts: receipts.length,
      totalAmount: Math.round(totalAmount * 100) / 100,
      averageAmount: receipts.length > 0 ? Math.round((totalAmount / receipts.length) * 100) / 100 : 0,
      byCategory: Array.from(categoryMap.entries())
        .map(([category, data]) => ({ category, ...data }))
        .sort((a, b) => b.amount - a.amount),
      byStore: Array.from(storeMap.entries())
        .map(([store, data]) => ({ store, ...data }))
        .sort((a, b) => b.amount - a.amount),
      topItems: Array.from(itemMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 20),
    };
  }

  async checkDuplicate(familyId: string, amount: number, date: Date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    return this.prisma.receipt.findFirst({
      where: {
        familyId,
        amount,
        date: { gte: dayStart, lte: dayEnd },
      },
      select: { id: true, description: true },
    });
  }

  async suggestCategory(familyId: string, description: string) {
    // Find receipts with similar descriptions and count category occurrences
    const receipts = await this.prisma.receipt.findMany({
      where: {
        familyId,
        categoryId: { not: null },
        description: { contains: description.split(' ')[0], mode: 'insensitive' },
      },
      select: { categoryId: true },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    if (receipts.length < 3) return null;

    const counts = new Map<string, number>();
    for (const r of receipts) {
      if (r.categoryId) {
        counts.set(r.categoryId, (counts.get(r.categoryId) ?? 0) + 1);
      }
    }

    // Return the most frequent category if it appears in >= 80% of results
    let maxId = '';
    let maxCount = 0;
    for (const [id, count] of counts) {
      if (count > maxCount) { maxId = id; maxCount = count; }
    }

    return maxCount / receipts.length >= 0.8 ? maxId : null;
  }
  // #endregion

  // #region Update
  async updateReceipt(id: string, familyId: string, input: {
    description?: string;
    amount?: number;
    currency?: string;
    date?: Date;
    categoryId?: string;
    personId?: string;
    storeId?: string;
    billId?: string;
    imageUrl?: string;
    notes?: string;
    items?: { name: string; quantity?: number; unitPrice: number; total: number; categoryId?: string }[];
    tagIds?: string[];
  }) {
    const data: any = {};

    if (input.description !== undefined) data.description = input.description;
    if (input.amount !== undefined) data.amount = input.amount;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.date !== undefined) data.date = input.date;
    if (input.categoryId !== undefined) data.categoryId = input.categoryId;
    if (input.personId !== undefined) data.personId = input.personId;
    if (input.storeId !== undefined) data.storeId = input.storeId;
    if (input.billId !== undefined) data.billId = input.billId;
    if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
    if (input.notes !== undefined) data.notes = input.notes;

    // If items are provided, replace all items
    if (input.items !== undefined) {
      await this.prisma.receiptItem.deleteMany({ where: { receiptId: id } });
      if (input.items.length > 0) {
        data.items = {
          create: input.items.map((item) => ({
            name: item.name,
            quantity: item.quantity ?? 1,
            unitPrice: item.unitPrice,
            total: item.total,
            categoryId: item.categoryId,
          })),
        };
      }
    }

    // If tagIds are provided, replace all tags
    if (input.tagIds !== undefined) {
      await this.prisma.receiptTag.deleteMany({ where: { receiptId: id } });
      if (input.tagIds.length > 0) {
        data.tags = {
          create: input.tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })),
        };
      }
    }

    const receipt = await this.prisma.receipt.update({
      where: { id, familyId },
      data,
      include: RECEIPT_INCLUDE,
    });

    return this._mapReceipt(receipt);
  }
  // #endregion

  // #region Delete
  async deleteReceipt(id: string, familyId: string) {
    return this.prisma.receipt.delete({
      where: { id, familyId },
    });
  }
  // #endregion

  // #region Misc
  async cleanupExpiredReceiptImages(maxAgeDays = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxAgeDays);

    const result = await this.prisma.receipt.updateMany({
      where: {
        createdAt: { lt: cutoff },
        imageUrl: { startsWith: 'data:' },
      },
      data: { imageUrl: null },
    });

    return { cleaned: result.count };
  }
  // #endregion
}
