import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

// ─── Include patterns ─────────────────────────────────

const PARTICIPANT_SELECT = {
  id: true,
  splitId: true,
  userId: true,
  nickname: true,
  email: true,
  isAdmin: true,
  isSettled: true,
  createdAt: true,
};

const SPLIT_INCLUDE = {
  participants: { select: PARTICIPANT_SELECT, orderBy: { createdAt: 'asc' as const } },
  receipts: {
    include: {
      items: {
        include: { claims: { include: { participant: { select: PARTICIPANT_SELECT } } } },
        orderBy: { sortOrder: 'asc' as const },
      },
      paidBy: { select: PARTICIPANT_SELECT },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  messages: {
    include: { participant: { select: PARTICIPANT_SELECT } },
    orderBy: { createdAt: 'asc' as const },
  },
};

// ─── Helpers ──────────────────────────────────────────

function mapDecimal(val: Prisma.Decimal | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  return Number(val);
}

function mapSplit(split: any) {
  if (!split) return split;
  const result = { ...split };
  if (result.receipts) {
    result.receipts = result.receipts.map((r: any) => ({
      ...r,
      totalAmount: mapDecimal(r.totalAmount),
      items: r.items?.map((item: any) => ({
        ...item,
        quantity: mapDecimal(item.quantity),
        unitPrice: mapDecimal(item.unitPrice),
        total: mapDecimal(item.total),
      })),
    }));
  }
  return result;
}

// ─── Service ──────────────────────────────────────────

@Injectable()
export class SplitActionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Private ──────────────────────────────────────

  // ─── Create ───────────────────────────────────────

  async createSplit(data: {
    eventId: string;
    inviteCode: string;
    name: string;
    currency: string;
    adminUserId: string;
    adminNickname: string;
  }) {
    const split = await this.prisma.split.create({
      data: {
        eventId: data.eventId,
        inviteCode: data.inviteCode,
        name: data.name,
        currency: data.currency,
        participants: {
          create: {
            userId: data.adminUserId,
            nickname: data.adminNickname,
            isAdmin: true,
          },
        },
      },
      include: SPLIT_INCLUDE,
    });
    return mapSplit(split);
  }

  async addParticipant(data: {
    splitId: string;
    userId?: string;
    nickname: string;
    email?: string;
    guestToken?: string;
  }) {
    return this.prisma.splitParticipant.create({
      data: {
        splitId: data.splitId,
        userId: data.userId || null,
        nickname: data.nickname,
        email: data.email || null,
        guestToken: data.guestToken || null,
      },
      select: PARTICIPANT_SELECT,
    });
  }

  async createMessage(data: {
    splitId: string;
    participantId: string;
    content?: string;
    type: string;
    splitReceiptId?: string;
  }) {
    return this.prisma.splitMessage.create({
      data: {
        splitId: data.splitId,
        participantId: data.participantId,
        content: data.content || null,
        type: data.type,
        splitReceiptId: data.splitReceiptId || null,
      },
      include: { participant: { select: PARTICIPANT_SELECT } },
    });
  }

  async createReceipt(data: {
    splitId: string;
    uploadedByParticipantId: string;
    paidByParticipantId: string;
    imageUrl?: string;
    storeName?: string;
    totalAmount: number;
    ocrRawText?: string;
    items: { name: string; quantity: number; unitPrice: number; total: number }[];
  }) {
    return this.prisma.splitReceipt.create({
      data: {
        splitId: data.splitId,
        uploadedByParticipantId: data.uploadedByParticipantId,
        paidByParticipantId: data.paidByParticipantId,
        imageUrl: data.imageUrl || null,
        storeName: data.storeName || null,
        totalAmount: data.totalAmount,
        ocrRawText: data.ocrRawText || null,
        items: {
          create: data.items.map((item, i) => ({
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            sortOrder: i,
          })),
        },
      },
      include: {
        items: {
          include: { claims: { include: { participant: { select: PARTICIPANT_SELECT } } } },
          orderBy: { sortOrder: 'asc' },
        },
        paidBy: { select: PARTICIPANT_SELECT },
      },
    });
  }

  async addClaim(splitReceiptItemId: string, participantId: string) {
    return this.prisma.splitItemClaim.create({
      data: { splitReceiptItemId, participantId },
      include: { participant: { select: PARTICIPANT_SELECT } },
    });
  }

  // ─── Read ─────────────────────────────────────────

  async getSplitById(id: string) {
    const split = await this.prisma.split.findUnique({
      where: { id },
      include: SPLIT_INCLUDE,
    });
    return mapSplit(split);
  }

  async getSplitByInviteCode(code: string) {
    const split = await this.prisma.split.findUnique({
      where: { inviteCode: code },
      include: SPLIT_INCLUDE,
    });
    return mapSplit(split);
  }

  async getSplitsByEventId(eventId: string) {
    const splits = await this.prisma.split.findMany({
      where: { eventId },
      include: SPLIT_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return splits.map(mapSplit);
  }

  async getParticipantByGuestToken(guestToken: string) {
    return this.prisma.splitParticipant.findUnique({
      where: { guestToken },
      select: { ...PARTICIPANT_SELECT, guestToken: true, split: { select: { id: true, name: true, inviteCode: true, status: true } } },
    });
  }

  async getReceiptWithItems(receiptId: string) {
    const receipt = await this.prisma.splitReceipt.findUnique({
      where: { id: receiptId },
      include: {
        items: {
          include: { claims: { include: { participant: { select: PARTICIPANT_SELECT } } } },
          orderBy: { sortOrder: 'asc' },
        },
        paidBy: { select: PARTICIPANT_SELECT },
      },
    });
    if (!receipt) return null;
    return {
      ...receipt,
      totalAmount: mapDecimal(receipt.totalAmount),
      items: receipt.items.map((item) => ({
        ...item,
        quantity: mapDecimal(item.quantity),
        unitPrice: mapDecimal(item.unitPrice),
        total: mapDecimal(item.total),
      })),
    };
  }

  async getMessages(splitId: string, cursor?: string, limit = 50) {
    const where: Prisma.SplitMessageWhereInput = { splitId };
    if (cursor) {
      where.createdAt = { lt: new Date(cursor) };
    }
    return this.prisma.splitMessage.findMany({
      where,
      include: { participant: { select: PARTICIPANT_SELECT } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ─── Update ───────────────────────────────────────

  async updateReceipt(
    receiptId: string,
    data: {
      storeName?: string;
      totalAmount?: number;
      paidByParticipantId?: string;
      isConfirmed?: boolean;
      items?: { name: string; quantity: number; unitPrice: number; total: number }[];
    },
  ) {
    const updateData: Prisma.SplitReceiptUpdateInput = {};
    if (data.storeName !== undefined) updateData.storeName = data.storeName;
    if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount;
    if (data.paidByParticipantId !== undefined) {
      updateData.paidBy = { connect: { id: data.paidByParticipantId } };
    }
    if (data.isConfirmed !== undefined) updateData.isConfirmed = data.isConfirmed;

    // If items provided, delete old ones and create new
    if (data.items) {
      await this.prisma.splitReceiptItem.deleteMany({ where: { splitReceiptId: receiptId } });
      await this.prisma.splitReceiptItem.createMany({
        data: data.items.map((item, i) => ({
          splitReceiptId: receiptId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          sortOrder: i,
        })),
      });
    }

    const receipt = await this.prisma.splitReceipt.update({
      where: { id: receiptId },
      data: updateData,
      include: {
        items: {
          include: { claims: { include: { participant: { select: PARTICIPANT_SELECT } } } },
          orderBy: { sortOrder: 'asc' },
        },
        paidBy: { select: PARTICIPANT_SELECT },
      },
    });

    return {
      ...receipt,
      totalAmount: mapDecimal(receipt.totalAmount),
      items: receipt.items.map((item) => ({
        ...item,
        quantity: mapDecimal(item.quantity),
        unitPrice: mapDecimal(item.unitPrice),
        total: mapDecimal(item.total),
      })),
    };
  }

  async setParticipantSettled(participantId: string, isSettled: boolean) {
    return this.prisma.splitParticipant.update({
      where: { id: participantId },
      data: { isSettled },
      select: PARTICIPANT_SELECT,
    });
  }

  async setSplitStatus(splitId: string, status: 'ACTIVE' | 'SETTLED' | 'ARCHIVED') {
    return this.prisma.split.update({
      where: { id: splitId },
      data: { status },
    });
  }

  // ─── Delete ───────────────────────────────────────

  async removeClaim(splitReceiptItemId: string, participantId: string) {
    return this.prisma.splitItemClaim.delete({
      where: {
        splitReceiptItemId_participantId: { splitReceiptItemId, participantId },
      },
    });
  }

  async deleteSplit(splitId: string) {
    return this.prisma.split.delete({ where: { id: splitId } });
  }

  // ─── Misc ─────────────────────────────────────────

  async checkAllSettled(splitId: string): Promise<boolean> {
    const participants = await this.prisma.splitParticipant.findMany({
      where: { splitId },
      select: { isSettled: true },
    });
    return participants.length > 0 && participants.every((p) => p.isSettled);
  }
}
