import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { SessionAuthGuard } from '../../shared/guards/auth.guard';
import { SplitAuthGuard } from '../../shared/guards/split-auth.guard';
import { FamilyId, UserId } from '../../shared/decorators/session.decorator';
import { SplitParticipantId, SplitId, SplitIsAdmin } from '../../shared/decorators/split.decorator';
import { SplitContextService } from './split-context.service';
import {
  CreateSplitDto,
  JoinSplitDto,
  SendMessageDto,
  CreateSplitReceiptDto,
  UpdateSplitReceiptDto,
  ClaimItemDto,
} from './dto/split.dto';
import { Request } from 'express';

@Controller('v2/splits')
export class SplitController {
  constructor(private readonly splitContext: SplitContextService) {}

  // ─── Public (no split auth needed) ────────────────

  /** Preview split info before joining (public by invite code) */
  @Get('join/:code')
  async getSplitPreview(@Param('code') code: string) {
    return this.splitContext.getSplitByCode(code);
  }

  /** Join a split via invite code. Works for both registered users and guests. */
  @Post('join/:code')
  async joinSplit(
    @Param('code') code: string,
    @Body() dto: JoinSplitDto,
    @Req() req: Request,
  ) {
    const userId = req.session?.userId;
    return this.splitContext.joinSplit(code, dto, userId);
  }

  // ─── Requires app account (creating splits) ──────

  @Post()
  @UseGuards(SessionAuthGuard)
  async createSplit(
    @UserId() userId: string,
    @FamilyId() familyId: string,
    @Body() dto: CreateSplitDto,
    @Req() req: Request,
  ) {
    const username = req.session?.username || 'Admin';
    return this.splitContext.createSplit(userId, username, familyId, dto);
  }

  /** Get splits for a specific event (requires app account) */
  @Get('event/:eventId')
  @UseGuards(SessionAuthGuard)
  async getSplitsForEvent(@Param('eventId') eventId: string) {
    return this.splitContext.getSplitsForEvent(eventId);
  }

  // ─── Requires split participation ─────────────────

  @Get(':splitId')
  @UseGuards(SplitAuthGuard)
  async getSplit(@SplitId() splitId: string) {
    return this.splitContext.getSplit(splitId);
  }

  @Get(':splitId/messages')
  @UseGuards(SplitAuthGuard)
  async getMessages(
    @SplitId() splitId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.splitContext.getMessages(splitId, cursor);
  }

  @Post(':splitId/messages')
  @UseGuards(SplitAuthGuard)
  async sendMessage(
    @SplitId() splitId: string,
    @SplitParticipantId() participantId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.splitContext.sendMessage(splitId, participantId, dto);
  }

  @Post(':splitId/receipts')
  @UseGuards(SplitAuthGuard)
  async createReceipt(
    @SplitId() splitId: string,
    @SplitParticipantId() participantId: string,
    @Body() dto: CreateSplitReceiptDto,
  ) {
    return this.splitContext.createReceipt(splitId, participantId, dto);
  }

  @Put(':splitId/receipts/:receiptId')
  @UseGuards(SplitAuthGuard)
  async updateReceipt(
    @SplitId() splitId: string,
    @Param('receiptId') receiptId: string,
    @Body() dto: UpdateSplitReceiptDto,
  ) {
    return this.splitContext.updateReceipt(splitId, receiptId, dto);
  }

  @Post(':splitId/claims')
  @UseGuards(SplitAuthGuard)
  async claimItem(
    @SplitId() splitId: string,
    @SplitParticipantId() participantId: string,
    @Body() dto: ClaimItemDto,
  ) {
    return this.splitContext.claimItem(splitId, participantId, dto);
  }

  @Delete(':splitId/claims/:itemId')
  @UseGuards(SplitAuthGuard)
  async unclaimItem(
    @SplitId() splitId: string,
    @SplitParticipantId() participantId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.splitContext.unclaimItem(splitId, participantId, itemId);
  }

  @Get(':splitId/summary')
  @UseGuards(SplitAuthGuard)
  async getSummary(@SplitId() splitId: string) {
    return this.splitContext.getSummary(splitId);
  }

  @Post(':splitId/summary')
  @UseGuards(SplitAuthGuard)
  async generateSummary(
    @SplitId() splitId: string,
    @SplitIsAdmin() isAdmin: boolean,
  ) {
    return this.splitContext.summarizeSplit(splitId, isAdmin);
  }

  @Post(':splitId/settle')
  @UseGuards(SplitAuthGuard)
  async markSettled(
    @SplitId() splitId: string,
    @SplitParticipantId() participantId: string,
  ) {
    return this.splitContext.markSettled(splitId, participantId);
  }

  @Delete(':splitId/settle')
  @UseGuards(SplitAuthGuard)
  async unmarkSettled(
    @SplitId() splitId: string,
    @SplitParticipantId() participantId: string,
  ) {
    return this.splitContext.unmarkSettled(splitId, participantId);
  }

  @Delete(':splitId')
  @UseGuards(SplitAuthGuard)
  async deleteSplit(
    @SplitId() splitId: string,
    @SplitIsAdmin() isAdmin: boolean,
  ) {
    return this.splitContext.deleteSplit(splitId, isAdmin);
  }
}
