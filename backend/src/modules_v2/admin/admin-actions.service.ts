import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { User, Role } from '@prisma/client';

@Injectable()
export class AdminActionsService {
  constructor(private readonly prisma: PrismaService) {}

  // #region Read
  async findAllUsers(): Promise<User[]> {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async countUsers(): Promise<number> {
    return this.prisma.user.count();
  }

  async countUsersByRole(role: Role): Promise<number> {
    return this.prisma.user.count({ where: { role } });
  }
  // #endregion
}
