import { Injectable } from '@nestjs/common';
import { AdminActionsService } from './admin-actions.service';
import { IUser } from '../../shared/models/auth';

@Injectable()
export class AdminContextService {
  constructor(private readonly adminActions: AdminActionsService) {}

  // #region Read
  async getAllUsers(): Promise<IUser[]> {
    const users = await this.adminActions.findAllUsers();

    return users.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      familyId: null,
      familyRole: null,
    }));
  }

  async getStats(): Promise<{ totalUsers: number; adminCount: number; userCount: number }> {
    const [totalUsers, adminCount] = await Promise.all([
      this.adminActions.countUsers(),
      this.adminActions.countUsersByRole('ADMIN'),
    ]);

    return {
      totalUsers,
      adminCount,
      userCount: totalUsers - adminCount,
    };
  }
  // #endregion
}
