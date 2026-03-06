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
    const where: Prisma.TemplateRecordWhereInput = { templateId };

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
      // Delete removed records
      if (deletedIds?.length) {
        await tx.templateRecord.deleteMany({
          where: { id: { in: deletedIds }, templateId },
        });
      }

      // Upsert records
      for (const record of records) {
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
