import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { Prisma, TemplateRecord } from '@prisma/client';

@Injectable()
export class RecordActionsService {
  constructor(private readonly prisma: PrismaService) {}

  // #region Create
  async createRecord(data: Prisma.TemplateRecordUncheckedCreateInput): Promise<TemplateRecord> {
    return this.prisma.templateRecord.create({ data });
  }

  async createManyRecords(records: Prisma.TemplateRecordUncheckedCreateInput[]): Promise<number> {
    const result = await this.prisma.templateRecord.createMany({ data: records });
    return result.count;
  }
  // #endregion

  // #region Read
  async findRecordsByTemplate(
    templateId: string,
    options?: {
      skip?: number;
      take?: number;
      orderBy?: 'asc' | 'desc';
      search?: string;
    },
  ): Promise<{ records: TemplateRecord[]; total: number }> {
    const where: Prisma.TemplateRecordWhereInput = {
      templateId,
      // Exclude soft-deleted auto-expense tombstones from regular queries
      NOT: { data: { path: ['_autoExpenseDeleted'], equals: true } as any },
    };

    const [records, total] = await Promise.all([
      this.prisma.templateRecord.findMany({
        where,
        skip: options?.skip,
        take: options?.take,
        orderBy: { sortOrder: options?.orderBy ?? 'asc' },
      }),
      this.prisma.templateRecord.count({ where }),
    ]);

    return { records, total };
  }

  async findRecordById(id: string, templateId: string): Promise<TemplateRecord | null> {
    return this.prisma.templateRecord.findFirst({
      where: { id, templateId },
    });
  }

  async findBillAutoExpenseRecordByOccurrence(
    templateId: string,
    billId: string,
    occurrenceDateIso: string,
  ): Promise<TemplateRecord | null> {
    return this.prisma.templateRecord.findFirst({
      where: {
        templateId,
        AND: [
          { data: { path: ['_billId'], equals: billId } as any },
          {
            OR: [
              { data: { path: ['_billOccurrenceDate'], equals: occurrenceDateIso } as any },
              { data: { path: ['col_date'], equals: occurrenceDateIso } as any },
            ],
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAutoExpenseRecordCandidates(
    familyId: string,
    billId: string,
    amount: number,
    dateIso: string,
  ): Promise<TemplateRecord[]> {
    return this.prisma.templateRecord.findMany({
      where: {
        template: { familyId },
        AND: [
          { data: { path: ['_billId'], equals: billId } as any },
          { data: { path: ['col_type'], equals: 'Wydatek' } as any },
          { data: { path: ['col_amount', 'amount'], equals: amount } as any },
          { data: { path: ['col_date'], equals: dateIso } as any },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
  }

  async deleteAutoExpenseRecordsByBillPaymentId(familyId: string, paymentId: string): Promise<number> {
    const result = await this.prisma.templateRecord.deleteMany({
      where: {
        template: { familyId },
        data: { path: ['_billPaymentId'], equals: paymentId } as any,
      },
    });

    return result.count;
  }

  async getMaxSortOrder(templateId: string): Promise<number> {
    const result = await this.prisma.templateRecord.aggregate({
      where: { templateId },
      _max: { sortOrder: true },
    });
    return result._max.sortOrder ?? 0;
  }
  // #endregion

  // #region Update
  async updateRecord(id: string, data: Prisma.TemplateRecordUpdateInput): Promise<TemplateRecord> {
    return this.prisma.templateRecord.update({
      where: { id },
      data,
    });
  }

  async bulkUpsertRecords(
    templateId: string,
    records: { id?: string; data: any; sortOrder?: number }[],
    deletedIds?: string[],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Track soft-deleted IDs so the upsert loop below skips them.
      const softDeleteIds: string[] = [];

      // Handle deleted records — soft-delete auto-expense rows (those with
      // _billId) so the sync logic doesn't recreate them, hard-delete the rest.
      if (deletedIds?.length) {
        const toDelete = await tx.templateRecord.findMany({
          where: { id: { in: deletedIds }, templateId },
          select: { id: true, data: true },
        });

        const hardDeleteIds: string[] = [];

        for (const rec of toDelete) {
          const recData = (rec.data as Record<string, any>) ?? {};
          if (recData._billId) {
            softDeleteIds.push(rec.id);
          } else {
            hardDeleteIds.push(rec.id);
          }
        }

        if (hardDeleteIds.length) {
          await tx.templateRecord.deleteMany({
            where: { id: { in: hardDeleteIds }, templateId },
          });
        }

        for (const id of softDeleteIds) {
          const existing = toDelete.find((r: { id: string; data: any }) => r.id === id);
          const existingData = (existing?.data as Record<string, any>) ?? {};
          await tx.templateRecord.update({
            where: { id },
            data: { data: { ...existingData, _autoExpenseDeleted: true } },
          });
        }
      }

      // Upsert records — skip any that were just soft-deleted above.
      for (const record of records) {
        if (record.id && softDeleteIds.includes(record.id)) continue;
        if (record.id) {
          await tx.templateRecord.update({
            where: { id: record.id },
            data: {
              data: record.data,
              ...(record.sortOrder !== undefined && { sortOrder: record.sortOrder }),
            },
          });
        } else {
          await tx.templateRecord.create({
            data: {
              templateId,
              data: record.data,
              sortOrder: record.sortOrder ?? 0,
            },
          });
        }
      }
    });
  }
  // #endregion

  // #region Delete
  async deleteRecord(id: string): Promise<void> {
    await this.prisma.templateRecord.delete({ where: { id } });
  }

  async deleteRecordsByTemplate(templateId: string): Promise<void> {
    await this.prisma.templateRecord.deleteMany({ where: { templateId } });
  }
  // #endregion
}
