import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class FamilyActionsService {
  constructor(private readonly prisma: PrismaService) {}

  // #region Private
  // #endregion

  // #region Create
  async createFamilyMember(input: { userId: string; familyId: string; role?: string }) {
    const data: any = {
      user: { connect: { id: input.userId } },
      family: { connect: { id: input.familyId } },
    };

    if (input.role) {
      data.role = input.role;
    }

    return this.prisma.familyMember.create({ data });
  }
  // #endregion

  // #region Read
  async findFamilyById(id: string) {
    return this.prisma.family.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  async findFamilyMembers(familyId: string) {
    return this.prisma.familyMember.findMany({
      where: { familyId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async findUserByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  async findFamilyMemberByUserAndFamily(userId: string, familyId: string) {
    return this.prisma.familyMember.findUnique({
      where: { userId_familyId: { userId, familyId } },
    });
  }
  // #endregion

  // #region Update
  // #endregion

  // #region Delete
  async removeFamilyMember(id: string, familyId: string) {
    return this.prisma.familyMember.delete({
      where: { id, familyId },
    });
  }
  // #endregion

  // #region Misc
  // #endregion
}
