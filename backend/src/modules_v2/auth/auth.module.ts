import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthContextService } from './auth-context.service';
import { AuthActionsService } from './auth-actions.service';

@Module({
  controllers: [AuthController],
  providers: [AuthContextService, AuthActionsService],
})
export class AuthModule {}
