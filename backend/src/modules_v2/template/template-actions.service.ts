import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { Prisma, Template } from '@prisma/client';

@Injectable()
export class TemplateActionsService {
  constructor(private readonly prisma: PrismaService) {}

  // #region Create
  async createTemplate(data: Prisma.TemplateUncheckedCreateInput): Promise<Template> {
    return this.prisma.template.create({ data });
  }
  // #endregion

  // #region Read
  async findTemplatesByFamily(familyId: string): Promise<Template[]> {
    return this.prisma.template.findMany({
      where: { familyId },
      include: {
        createdBy: { select: { id: true, username: true, firstName: true, lastName: true } },
        _count: { select: { records: true } },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findTemplateById(id: string, familyId: string): Promise<Template | null> {
    return this.prisma.template.findFirst({
      where: { id, familyId },
      include: {
        createdBy: { select: { id: true, username: true, firstName: true, lastName: true } },
        _count: { select: { records: true } },
      },
    });
  }

  async findDefaultTemplate(familyId: string): Promise<Template | null> {
    return this.prisma.template.findFirst({
      where: { familyId, isDefault: true },
      include: {
        createdBy: { select: { id: true, username: true, firstName: true, lastName: true } },
      },
    });
  }
  // #endregion

  // #region Update
  async updateTemplate(id: string, data: Prisma.TemplateUpdateInput): Promise<Template> {
    return this.prisma.template.update({
      where: { id },
      data,
    });
  }

  async clearDefaultFlag(familyId: string): Promise<void> {
    await this.prisma.template.updateMany({
      where: { familyId, isDefault: true },
      data: { isDefault: false },
    });
  }
  // #endregion

  // #region Delete
  async deleteTemplate(id: string): Promise<void> {
    await this.prisma.template.delete({ where: { id } });
  }
  // #endregion
}
