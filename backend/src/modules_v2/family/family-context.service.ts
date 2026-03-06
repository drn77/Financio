import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { FamilyActionsService } from './family-actions.service';

@Injectable()
export class FamilyContextService {
  constructor(private readonly familyActions: FamilyActionsService) {}

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

  // #region Misc
  // #endregion
}
