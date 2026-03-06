import { Controller, Get, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../../shared/guards/auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { AdminContextService } from './admin-context.service';
import { IUser } from '../../shared/models/auth';

@Controller('v2/admin')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminContext: AdminContextService) {}

  @Get('users')
  async getUsers(): Promise<{ users: IUser[] }> {
    const users = await this.adminContext.getAllUsers();
    return { users };
  }

  @Get('stats')
  async getStats(): Promise<{ totalUsers: number; adminCount: number; userCount: number }> {
    return this.adminContext.getStats();
  }
}
