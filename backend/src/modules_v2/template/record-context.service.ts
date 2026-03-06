import { Injectable, NotFoundException } from '@nestjs/common';
import { RecordActionsService } from './record-actions.service';
import { TemplateActionsService } from './template-actions.service';
import { CreateRecordDto } from './dto/create-record.dto';
import { UpdateRecordDto } from './dto/update-record.dto';
import { BulkUpdateRecordsDto } from './dto/bulk-update-records.dto';
import { ImportRecordsDto } from './dto/import-records.dto';

@Injectable()
export class RecordContextService {
  constructor(
    private readonly recordActions: RecordActionsService,
    private readonly templateActions: TemplateActionsService,
  ) {}

  // #region Read
  async getRecords(
    templateId: string,
    familyId: string,
    query?: { page?: number; limit?: number; sort?: 'asc' | 'desc' },
  ) {
    // Verify template belongs to family
    const template = await this.templateActions.findTemplateById(templateId, familyId);
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const page = query?.page ?? 1;
    const limit = query?.limit ?? 100;
    const skip = (page - 1) * limit;

    const { records, total } = await this.recordActions.findRecordsByTemplate(templateId, {
      skip,
      take: limit,
      orderBy: query?.sort ?? 'asc',
    });

    return {
      records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getRecordStats(
    templateId: string,
    familyId: string,
    filters?: { from?: string; to?: string },
  ) {
    const template = await this.templateActions.findTemplateById(templateId, familyId);
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const { records } = await this.recordActions.findRecordsByTemplate(templateId, {
      take: 10000,
      orderBy: 'asc',
    });

    let filtered = records;

    if (filters?.from || filters?.to) {
      filtered = filtered.filter((r: any) => {
        const date = r.data?.col_date;
        if (!date) return true;
        if (filters.from && date < filters.from) return false;
        if (filters.to && date > filters.to) return false;
        return true;
      });
    }

    let totalAmount = 0;
    const byCategory: Record<string, number> = {};
    const byPerson: Record<string, number> = {};
    let paidCount = 0;
    let unpaidCount = 0;

    for (const record of filtered) {
      const data = record.data as Record<string, any>;
      const amountField = data?.col_amount;
      const amount =
        typeof amountField === 'object' && amountField?.amount != null
          ? Number(amountField.amount)
          : typeof amountField === 'number'
            ? amountField
            : 0;

      totalAmount += amount;

      const categories = Array.isArray(data?.col_category)
        ? data.col_category
        : data?.col_category
          ? [data.col_category]
          : [];
      for (const cat of categories) {
        byCategory[cat] = (byCategory[cat] ?? 0) + amount;
      }

      const person = data?.col_person;
      if (person) {
        byPerson[person] = (byPerson[person] ?? 0) + amount;
      }

      if (data?.col_paid) {
        paidCount++;
      } else {
        unpaidCount++;
      }
    }

    return {
      totalRecords: filtered.length,
      totalAmount: Math.round(totalAmount * 100) / 100,
      averageAmount: filtered.length > 0 ? Math.round((totalAmount / filtered.length) * 100) / 100 : 0,
      byCategory: Object.entries(byCategory)
        .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
        .sort((a, b) => b.amount - a.amount),
      byPerson: Object.entries(byPerson)
        .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
        .sort((a, b) => b.amount - a.amount),
      paidCount,
      unpaidCount,
    };
  }
  // #endregion

  // #region Create
  async createRecord(templateId: string, familyId: string, input: CreateRecordDto) {
    const template = await this.templateActions.findTemplateById(templateId, familyId);
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const maxSort = await this.recordActions.getMaxSortOrder(templateId);

    return this.recordActions.createRecord({
      templateId,
      data: input.data,
      sortOrder: input.sortOrder ?? maxSort + 1,
    });
  }

  async duplicateRecord(recordId: string, templateId: string, familyId: string) {
    const template = await this.templateActions.findTemplateById(templateId, familyId);
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const record = await this.recordActions.findRecordById(recordId, templateId);
    if (!record) {
      throw new NotFoundException('Record not found');
    }

    const maxSort = await this.recordActions.getMaxSortOrder(templateId);

    const newData = { ...(record.data as Record<string, any>) };
    if (newData.col_date) {
      newData.col_date = new Date().toISOString().split('T')[0];
    }
    if ('col_paid' in newData) {
      newData.col_paid = false;
    }

    return this.recordActions.createRecord({
      templateId,
      data: newData,
      sortOrder: maxSort + 1,
    });
  }

  async importRecords(templateId: string, familyId: string, input: ImportRecordsDto) {
    const template = await this.templateActions.findTemplateById(templateId, familyId);
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const maxSort = await this.recordActions.getMaxSortOrder(templateId);

    const records = input.records.map((r, index) => ({
      templateId,
      data: r.data,
      sortOrder: r.sortOrder ?? maxSort + index + 1,
    }));

    const count = await this.recordActions.createManyRecords(records);

    return { imported: count };
  }
  // #endregion

  // #region Update
  async updateRecord(
    recordId: string,
    templateId: string,
    familyId: string,
    input: UpdateRecordDto,
  ) {
    const template = await this.templateActions.findTemplateById(templateId, familyId);
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const record = await this.recordActions.findRecordById(recordId, templateId);
    if (!record) {
      throw new NotFoundException('Record not found');
    }

    return this.recordActions.updateRecord(recordId, {
      ...(input.data !== undefined && { data: input.data }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    });
  }

  async bulkUpdate(templateId: string, familyId: string, input: BulkUpdateRecordsDto) {
    const template = await this.templateActions.findTemplateById(templateId, familyId);
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    await this.recordActions.bulkUpsertRecords(
      templateId,
      input.records,
      input.deletedIds,
    );

    // Return updated records
    const { records } = await this.recordActions.findRecordsByTemplate(templateId);
    return records;
  }
  // #endregion

  // #region Delete
  async deleteRecord(recordId: string, templateId: string, familyId: string) {
    const template = await this.templateActions.findTemplateById(templateId, familyId);
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const record = await this.recordActions.findRecordById(recordId, templateId);
    if (!record) {
      throw new NotFoundException('Record not found');
    }

    await this.recordActions.deleteRecord(recordId);
  }
  // #endregion
}
