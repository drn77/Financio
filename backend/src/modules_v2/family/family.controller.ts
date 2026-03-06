import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../../shared/guards/auth.guard';
import { FamilyId } from '../../shared/decorators/session.decorator';
import { FamilyContextService } from './family-context.service';
import { AddMemberDto } from './dto/add-member.dto';

@Controller('v2/family')
@UseGuards(SessionAuthGuard)
export class FamilyController {
  constructor(private readonly familyContext: FamilyContextService) {}

  @Get()
  async getFamily(@FamilyId() familyId: string) {
    return this.familyContext.getFamily(familyId);
  }

  @Get('members')
  async getMembers(@FamilyId() familyId: string) {
    return this.familyContext.getMembers(familyId);
  }

  @Post('members')
  async addMember(@FamilyId() familyId: string, @Body() input: AddMemberDto) {
    return this.familyContext.addMember(familyId, input.username);
  }

  @Delete('members/:id')
  async removeMember(@FamilyId() familyId: string, @Param('id') id: string) {
    await this.familyContext.removeMember(id, familyId);

    return { message: 'Member removed successfully' };
  }
}
