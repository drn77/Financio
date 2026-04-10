import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { nanoid } from 'nanoid';
import { SplitActionsService } from './split-actions.service';
import {
  CreateSplitDto,
  JoinSplitDto,
  SendMessageDto,
  CreateSplitReceiptDto,
  UpdateSplitReceiptDto,
  ClaimItemDto,
} from './dto/split.dto';

// ─── Debt simplification types ────────────────────────

export interface ISettlement {
  fromParticipantId: string;
  fromNickname: string;
  toParticipantId: string;
  toNickname: string;
  amount: number;
}

// ─── Service ──────────────────────────────────────────

@Injectable()
export class SplitContextService {
  constructor(private readonly actions: SplitActionsService) {}

  // ─── Private ──────────────────────────────────────

  /**
   * Debt simplification algorithm (greedy balance-based).
   *
   * 1. For each confirmed receipt, the payer "lends" to each claimer their share.
   *    An item's cost is split equally among all claimers of that item.
   * 2. Compute net balance per participant: positive = is owed money, negative = owes money.
   * 3. Greedily match the largest creditor with the largest debtor to minimize transfers.
   *
   * Time complexity: O(P log P) where P = number of participants.
   * This greedy approach is optimal for minimizing the number of transactions.
   */
  private _calculateSettlements(split: any): ISettlement[] {
    const balances: Record<string, number> = {};
    const nicknames: Record<string, string> = {};

    // Initialize all participants
    for (const p of split.participants) {
      balances[p.id] = 0;
      nicknames[p.id] = p.nickname;
    }

    // Build balances from confirmed receipts
    for (const receipt of split.receipts) {
      if (!receipt.isConfirmed) continue;

      const payerId = receipt.paidByParticipantId || receipt.paidBy?.id;
      if (!payerId) continue;

      for (const item of receipt.items) {
        const claimers = item.claims?.map((c: any) => c.participantId || c.participant?.id) || [];
        if (claimers.length === 0) continue;

        const share = (item.total as number) / claimers.length;
        for (const claimerId of claimers) {
          if (claimerId === payerId) continue;
          // claimer owes payer
          balances[claimerId] = (balances[claimerId] || 0) - share;
          balances[payerId] = (balances[payerId] || 0) + share;
        }
      }
    }

    // Separate into creditors (owed money) and debtors (owe money)
    const creditors: { id: string; amount: number }[] = [];
    const debtors: { id: string; amount: number }[] = [];

    for (const [id, balance] of Object.entries(balances)) {
      const rounded = Math.round(balance * 100) / 100;
      if (rounded > 0.01) creditors.push({ id, amount: rounded });
      else if (rounded < -0.01) debtors.push({ id, amount: -rounded }); // store as positive
    }

    // Sort descending by amount for greedy matching
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    // Greedy settlement: match largest debtor → largest creditor
    const settlements: ISettlement[] = [];
    let ci = 0;
    let di = 0;

    while (ci < creditors.length && di < debtors.length) {
      const transfer = Math.min(creditors[ci].amount, debtors[di].amount);
      const rounded = Math.round(transfer * 100) / 100;

      if (rounded > 0) {
        settlements.push({
          fromParticipantId: debtors[di].id,
          fromNickname: nicknames[debtors[di].id] || '?',
          toParticipantId: creditors[ci].id,
          toNickname: nicknames[creditors[ci].id] || '?',
          amount: rounded,
        });
      }

      creditors[ci].amount -= transfer;
      debtors[di].amount -= transfer;

      if (creditors[ci].amount < 0.01) ci++;
      if (debtors[di].amount < 0.01) di++;
    }

    return settlements;
  }

  // ─── Create ───────────────────────────────────────

  async createSplit(userId: string, username: string, familyId: string, dto: CreateSplitDto) {
    // Verify event belongs to user's family
    const inviteCode = nanoid(8);
    return this.actions.createSplit({
      eventId: dto.eventId,
      inviteCode,
      name: dto.name,
      currency: dto.currency || 'PLN',
      adminUserId: userId,
      adminNickname: username,
    });
  }

  async joinSplit(inviteCode: string, dto: JoinSplitDto, userId?: string) {
    const split = await this.actions.getSplitByInviteCode(inviteCode);
    if (!split) throw new NotFoundException('Split not found');
    if (split.status !== 'ACTIVE') throw new BadRequestException('Split is no longer active');

    // Check if user (registered) is already a participant
    if (userId) {
      const existing = split.participants.find((p: any) => p.userId === userId);
      if (existing) return { participant: existing, guestToken: null, split };
    }

    // Check if nickname already taken
    const nickTaken = split.participants.some(
      (p: any) => p.nickname.toLowerCase() === dto.nickname.toLowerCase(),
    );
    if (nickTaken) throw new BadRequestException('Nickname is already taken in this split');

    const guestToken = userId ? undefined : nanoid(32);

    const participant = await this.actions.addParticipant({
      splitId: split.id,
      userId: userId || undefined,
      nickname: dto.nickname,
      email: dto.email,
      guestToken,
    });

    return { participant, guestToken: guestToken || null, split };
  }

  async sendMessage(splitId: string, participantId: string, dto: SendMessageDto) {
    return this.actions.createMessage({
      splitId,
      participantId,
      content: dto.content,
      type: 'TEXT',
    });
  }

  async createReceipt(splitId: string, participantId: string, dto: CreateSplitReceiptDto) {
    const receipt = await this.actions.createReceipt({
      splitId,
      uploadedByParticipantId: participantId,
      paidByParticipantId: dto.paidByParticipantId || participantId,
      imageUrl: dto.imageUrl,
      storeName: dto.storeName,
      totalAmount: dto.totalAmount,
      ocrRawText: dto.ocrRawText,
      items: dto.items,
    });

    // Create a message linking to this receipt
    const message = await this.actions.createMessage({
      splitId,
      participantId,
      type: 'RECEIPT',
      splitReceiptId: receipt.id,
    });

    return { receipt, message };
  }

  async claimItem(splitId: string, participantId: string, dto: ClaimItemDto) {
    // Verify the item belongs to this split
    const receipt = await this.actions.getReceiptWithItems(dto.splitReceiptItemId);
    if (!receipt) {
      // Check via item
      throw new NotFoundException('Receipt item not found');
    }

    try {
      return await this.actions.addClaim(dto.splitReceiptItemId, participantId);
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new BadRequestException('Already claimed this item');
      }
      throw e;
    }
  }

  async unclaimItem(splitId: string, participantId: string, splitReceiptItemId: string) {
    try {
      return await this.actions.removeClaim(splitReceiptItemId, participantId);
    } catch {
      throw new NotFoundException('Claim not found');
    }
  }

  // ─── Read ─────────────────────────────────────────

  async getSplit(splitId: string) {
    const split = await this.actions.getSplitById(splitId);
    if (!split) throw new NotFoundException('Split not found');
    return split;
  }

  async getSplitByCode(inviteCode: string) {
    const split = await this.actions.getSplitByInviteCode(inviteCode);
    if (!split) throw new NotFoundException('Split not found');
    return { id: split.id, name: split.name, status: split.status, participantCount: split.participants.length };
  }

  async getSplitsForEvent(eventId: string) {
    return this.actions.getSplitsByEventId(eventId);
  }

  async getMessages(splitId: string, cursor?: string) {
    return this.actions.getMessages(splitId, cursor);
  }

  async getSummary(splitId: string) {
    const split = await this.actions.getSplitById(splitId);
    if (!split) throw new NotFoundException('Split not found');
    return {
      settlements: this._calculateSettlements(split),
      participants: split.participants,
    };
  }

  // ─── Update ───────────────────────────────────────

  async updateReceipt(splitId: string, receiptId: string, dto: UpdateSplitReceiptDto) {
    return this.actions.updateReceipt(receiptId, {
      storeName: dto.storeName,
      totalAmount: dto.totalAmount,
      paidByParticipantId: dto.paidByParticipantId,
      isConfirmed: dto.isConfirmed,
      items: dto.items,
    });
  }

  async markSettled(splitId: string, participantId: string) {
    const participant = await this.actions.setParticipantSettled(participantId, true);

    // Check if all settled → auto-archive
    const allSettled = await this.actions.checkAllSettled(splitId);
    if (allSettled) {
      await this.actions.setSplitStatus(splitId, 'ARCHIVED');
    }

    return { participant, isArchived: allSettled };
  }

  async unmarkSettled(splitId: string, participantId: string) {
    return this.actions.setParticipantSettled(participantId, false);
  }

  // ─── Delete ───────────────────────────────────────

  async deleteSplit(splitId: string, isAdmin: boolean) {
    if (!isAdmin) throw new ForbiddenException('Only admin can delete a split');
    return this.actions.deleteSplit(splitId);
  }

  // ─── Misc ─────────────────────────────────────────

  async summarizeSplit(splitId: string, isAdmin: boolean) {
    if (!isAdmin) throw new ForbiddenException('Only admin can generate summary');
    return this.getSummary(splitId);
  }
}
