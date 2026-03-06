import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class StoreActionsService {
  constructor(private readonly prisma: PrismaService) {}

  // #region Create
  async createStore(input: {
    familyId: string;
    name: string;
    defaultCategoryId?: string;
    icon?: string;
    address?: string;
    notes?: string;
  }) {
    return this.prisma.store.create({
      data: {
        family: { connect: { id: input.familyId } },
        name: input.name,
        defaultCategoryId: input.defaultCategoryId,
        icon: input.icon,
        address: input.address,
        notes: input.notes,
      },
    });
  }

  async findOrCreateStore(familyId: string, name: string) {
    const existing = await this.prisma.store.findFirst({
      where: { familyId, name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) return existing;

    return this.prisma.store.create({
      data: { family: { connect: { id: familyId } }, name },
    });
  }
  // #endregion

  // #region Read
  async findStoresByFamily(familyId: string) {
    const stores = await this.prisma.store.findMany({
      where: { familyId },
      include: {
        _count: { select: { receipts: true } },
      },
      orderBy: { name: 'asc' },
    });

    return stores.map((s) => ({
      ...s,
      receiptCount: s._count.receipts,
      _count: undefined,
    }));
  }

  async findStoreById(id: string, familyId: string) {
    return this.prisma.store.findFirst({
      where: { id, familyId },
    });
  }

  async getStoreStats(id: string, familyId: string) {
    const receipts = await this.prisma.receipt.findMany({
      where: { storeId: id, familyId },
      select: { amount: true, date: true },
      orderBy: { date: 'desc' },
    });

    if (receipts.length === 0) {
      return { receiptCount: 0, totalSpent: 0, averageReceipt: 0, lastVisit: null };
    }

    const totalSpent = receipts.reduce((sum, r) => sum + Number(r.amount), 0);

    return {
      receiptCount: receipts.length,
      totalSpent: Math.round(totalSpent * 100) / 100,
      averageReceipt: Math.round((totalSpent / receipts.length) * 100) / 100,
      lastVisit: receipts[0]?.date ?? null,
    };
  }
  // #endregion

  // #region Update
  async updateStore(id: string, familyId: string, input: {
    name?: string;
    defaultCategoryId?: string;
    icon?: string;
    address?: string;
    notes?: string;
  }) {
    return this.prisma.store.update({
      where: { id, familyId },
      data: input,
    });
  }
  // #endregion

  // #region Delete
  async deleteStore(id: string, familyId: string) {
    return this.prisma.store.delete({
      where: { id, familyId },
    });
  }
  // #endregion
}
