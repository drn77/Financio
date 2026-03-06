import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { TemplateActionsService } from './template-actions.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class TemplateContextService {
  constructor(private readonly templateActions: TemplateActionsService) {}

  // #region Read
  async getTemplates(familyId: string) {
    return this.templateActions.findTemplatesByFamily(familyId);
  }

  async getTemplate(id: string, familyId: string) {
    const template = await this.templateActions.findTemplateById(id, familyId);
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    return template;
  }

  async getDefaultTemplate(familyId: string) {
    const template = await this.templateActions.findDefaultTemplate(familyId);
    if (!template) {
      throw new NotFoundException('No default template found');
    }
    return template;
  }
  // #endregion

  // #region Create
  async createTemplate(familyId: string, userId: string, input: CreateTemplateDto) {
    // If setting as default, clear existing default
    if (input.isDefault) {
      await this.templateActions.clearDefaultFlag(familyId);
    }

    return this.templateActions.createTemplate({
      familyId,
      createdById: userId,
      name: input.name,
      description: input.description,
      icon: input.icon,
      columns: input.columns as any,
      isDefault: input.isDefault ?? false,
    });
  }
  // #endregion

  // #region Update
  async updateTemplate(id: string, familyId: string, input: UpdateTemplateDto) {
    const template = await this.templateActions.findTemplateById(id, familyId);
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // If setting as default, clear existing default
    if (input.isDefault) {
      await this.templateActions.clearDefaultFlag(familyId);
    }

    return this.templateActions.updateTemplate(id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.icon !== undefined && { icon: input.icon }),
      ...(input.columns !== undefined && { columns: input.columns as any }),
      ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
    });
  }
  // #endregion

  // #region Delete
  async deleteTemplate(id: string, familyId: string) {
    const template = await this.templateActions.findTemplateById(id, familyId);
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    await this.templateActions.deleteTemplate(id);
  }
  // #endregion
}
