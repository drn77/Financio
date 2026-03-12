import { Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../../shared/guards/auth.guard';
import { FamilyId } from '../../shared/decorators/session.decorator';
import { KanbanContextService } from './kanban-context.service';
import { UpdateKanbanConfigDto } from './dto/update-kanban-config.dto';
import { MoveKanbanCardDto } from './dto/move-kanban-card.dto';
import { GetKanbanCardDto } from './dto/get-kanban-card.dto';
import { UpdateKanbanCardDto } from './dto/update-kanban-card.dto';

@Controller('v2/kanban')
@UseGuards(SessionAuthGuard)
export class KanbanController {
  constructor(private readonly kanbanContext: KanbanContextService) {}

  @Get('config')
  async getConfig(@FamilyId() familyId: string) {
    return this.kanbanContext.getConfig(familyId);
  }

  @Put('config')
  async updateConfig(@FamilyId() familyId: string, @Body() input: UpdateKanbanConfigDto) {
    return this.kanbanContext.updateConfig(familyId, input);
  }

  @Get('board')
  async getBoard(@FamilyId() familyId: string) {
    return this.kanbanContext.getBoard(familyId);
  }

  @Post('move')
  async moveCard(@FamilyId() familyId: string, @Body() input: MoveKanbanCardDto) {
    return this.kanbanContext.moveCard(familyId, input);
  }

  @Get('card')
  async getCard(@FamilyId() familyId: string, @Query() query: GetKanbanCardDto) {
    return this.kanbanContext.getCardDetails(familyId, query.objectType, query.objectId);
  }

  @Put('card')
  async updateCard(@FamilyId() familyId: string, @Body() input: UpdateKanbanCardDto) {
    return this.kanbanContext.updateCard(familyId, input.objectType, input.objectId, input.patch);
  }
}
