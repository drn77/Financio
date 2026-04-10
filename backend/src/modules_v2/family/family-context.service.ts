import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { FamilyActionsService } from './family-actions.service';
import { TemplateActionsService } from '../template/template-actions.service';

@Injectable()
export class FamilyContextService {
  constructor(
    private readonly familyActions: FamilyActionsService,
    private readonly templateActions: TemplateActionsService,
  ) {}

  // #region Private
  // #endregion

  // #region Create
  async addMember(familyId: string, username: string) {
    const user = await this.familyActions.findUserByUsername(username);

    if (!user) {
      throw new NotFoundException(`User with username "${username}" not found`);
    }

    const existingMember = await this.familyActions.findFamilyMemberByUserAndFamily(user.id, familyId);

    if (existingMember) {
      throw new ConflictException(`User "${username}" is already a member of this family`);
    }

    const member = await this.familyActions.createFamilyMember({
      userId: user.id,
      familyId,
    });

    return member;
  }
  // #endregion

  // #region Read
  async getFamily(familyId: string) {
    const family = await this.familyActions.findFamilyById(familyId);

    if (!family) {
      throw new NotFoundException('Family not found');
    }

    return family;
  }

  async getMembers(familyId: string) {
    return this.familyActions.findFamilyMembers(familyId);
  }
  // #endregion

  // #region Update
  async getTagMappings(familyId: string) {
    const family = await this.familyActions.findFamilyById(familyId);
    if (!family) throw new NotFoundException('Family not found');
    return (family as any).tagMappings ?? {};
  }

  async updateTagMappings(familyId: string, data: { income?: string; expense?: string; planning?: string; costs?: string; savings?: string }) {
    return this.familyActions.updateTagMappings(familyId, data);
  }
  // #endregion

  // #region Delete
  async removeMember(memberId: string, familyId: string) {
    const members = await this.familyActions.findFamilyMembers(familyId);
    const member = members.find((m: any) => m.id === memberId);

    if (!member) {
      throw new NotFoundException('Member not found in this family');
    }

    await this.familyActions.removeFamilyMember(memberId, familyId);

    return;
  }
  // #endregion

  // #region Expense Mappings
  async getExpenseMappings(familyId: string) {
    const dashboardConfig = await this.familyActions.getDashboardConfig(familyId);
    const defaultTemplate = await this.templateActions.findDefaultTemplate(familyId);

    const columns = Array.isArray((defaultTemplate as any)?.columns)
      ? ((defaultTemplate as any).columns as any[])
      : [];

    const availableFields = columns
      .filter((c: any) => typeof c?.id === 'string')
      .map((c: any) => ({
        id: c.id,
        name: c.name ?? c.id,
        type: c.type ?? 'text',
        required: !!c.required,
        tagGroupId: c.tagGroupId ? String(c.tagGroupId) : null,
      }));

    const rawMappings = (dashboardConfig?.expenseMappings ?? {}) as Record<string, any>;

    // Also read legacy receipt config for backward compat
    const legacyReceiptFieldConfigs = dashboardConfig?.receiptExpenseFieldConfigs ?? null;
    if (!rawMappings.receipts && legacyReceiptFieldConfigs) {
      rawMappings.receipts = { fieldConfigs: legacyReceiptFieldConfigs };
    }

    return {
      availableFields,
      mappings: {
        bills: rawMappings.bills ?? { fieldConfigs: {} },
        receipts: rawMappings.receipts ?? { fieldConfigs: {} },
        savings: rawMappings.savings ?? { fieldConfigs: {} },
        taxes: rawMappings.taxes ?? { fieldConfigs: {} },
        invoices: rawMappings.invoices ?? { fieldConfigs: {} },
      },
    };
  }

  async updateExpenseMappings(
    familyId: string,
    sourceType: string,
    fieldConfigs: Record<string, any>,
  ) {
    const validTypes = ['bills', 'receipts', 'savings', 'taxes', 'invoices'];
    if (!validTypes.includes(sourceType)) {
      throw new NotFoundException(`Invalid source type: ${sourceType}`);
    }

    const dashboardConfig = await this.familyActions.getDashboardConfig(familyId);
    const expenseMappings = (dashboardConfig?.expenseMappings ?? {}) as Record<string, any>;
    expenseMappings[sourceType] = { fieldConfigs };

    // Sync receipt config to legacy location for backward compatibility
    if (sourceType === 'receipts') {
      dashboardConfig.receiptExpenseFieldConfigs = fieldConfigs;
    }

    dashboardConfig.expenseMappings = expenseMappings;
    await this.familyActions.updateDashboardConfig(familyId, dashboardConfig);

    return { sourceType, fieldConfigs };
  }
  // #endregion
}
