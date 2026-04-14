import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { SplitContextService } from './split-context.service';

/**
 * WebSocket gateway for real-time Split features.
 * Rooms: `split:{splitId}` — each participant joins their split room.
 *
 * Events emitted to clients:
 *   - split:message      — new chat message
 *   - split:receipt       — receipt created or updated
 *   - split:claim         — item claimed/unclaimed
 *   - split:participant   — participant joined or settlement status changed
 *   - split:archived      — split was auto-archived
 *
 * Events from clients:
 *   - split:join          — join a split room
 *   - split:message       — send a text message
 *   - split:claim         — claim an item
 *   - split:unclaim       — unclaim an item
 *   - split:settle        — mark as settled
 */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(',')
      : ['http://localhost:6100', 'http://192.168.0.25:6100'],
    credentials: true,
  },
  namespace: '/split',
})
export class SplitGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  // socket.id → { splitId, participantId }
  private connections = new Map<string, { splitId: string; participantId: string }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly splitContext: SplitContextService,
  ) {}

  // ─── Connection lifecycle ─────────────────────────

  handleConnection(client: Socket) {
    // Auth happens on split:join
  }

  handleDisconnect(client: Socket) {
    this.connections.delete(client.id);
  }

  // ─── Authenticate & join room ─────────────────────

  @SubscribeMessage('split:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { splitId: string; guestToken?: string; userId?: string },
  ) {
    const { splitId, guestToken, userId } = data;

    // Verify participant
    let participantId: string | null = null;

    if (userId) {
      const participant = await this.prisma.splitParticipant.findFirst({
        where: { splitId, userId },
      });
      if (participant) participantId = participant.id;
    }

    if (!participantId && guestToken) {
      const participant = await this.prisma.splitParticipant.findUnique({
        where: { guestToken },
      });
      if (participant && participant.splitId === splitId) {
        participantId = participant.id;
      }
    }

    if (!participantId) {
      client.emit('split:error', { message: 'Not authorized' });
      return;
    }

    // Leave previous rooms
    const prev = this.connections.get(client.id);
    if (prev) {
      client.leave(`split:${prev.splitId}`);
    }

    // Join new room
    client.join(`split:${splitId}`);
    this.connections.set(client.id, { splitId, participantId });

    client.emit('split:joined', { splitId, participantId });
  }

  // ─── Chat messages ───────────────────────────────

  @SubscribeMessage('split:message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { content: string },
  ) {
    const conn = this.connections.get(client.id);
    if (!conn) return;

    try {
      const message = await this.splitContext.sendMessage(conn.splitId, conn.participantId, {
        content: data.content,
      });

      this.server.to(`split:${conn.splitId}`).emit('split:message', message);
    } catch (e: any) {
      client.emit('split:error', { message: e.message || 'Failed to send message' });
    }
  }

  // ─── Item claims ──────────────────────────────────

  @SubscribeMessage('split:claim')
  async handleClaim(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { splitReceiptItemId: string },
  ) {
    const conn = this.connections.get(client.id);
    if (!conn) return;

    try {
      const claim = await this.splitContext.claimItem(conn.splitId, conn.participantId, {
        splitReceiptItemId: data.splitReceiptItemId,
      });
      this.server.to(`split:${conn.splitId}`).emit('split:claim', {
        action: 'add',
        splitReceiptItemId: data.splitReceiptItemId,
        participantId: conn.participantId,
        claim,
      });
    } catch (e: any) {
      client.emit('split:error', { message: e.message || 'Failed to claim' });
    }
  }

  @SubscribeMessage('split:unclaim')
  async handleUnclaim(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { splitReceiptItemId: string },
  ) {
    const conn = this.connections.get(client.id);
    if (!conn) return;

    try {
      await this.splitContext.unclaimItem(conn.splitId, conn.participantId, data.splitReceiptItemId);
      this.server.to(`split:${conn.splitId}`).emit('split:claim', {
        action: 'remove',
        splitReceiptItemId: data.splitReceiptItemId,
        participantId: conn.participantId,
      });
    } catch (e: any) {
      client.emit('split:error', { message: e.message || 'Failed to unclaim' });
    }
  }

  // ─── Settlement ───────────────────────────────────

  @SubscribeMessage('split:settle')
  async handleSettle(@ConnectedSocket() client: Socket) {
    const conn = this.connections.get(client.id);
    if (!conn) return;

    const result = await this.splitContext.markSettled(conn.splitId, conn.participantId);

    this.server.to(`split:${conn.splitId}`).emit('split:participant', {
      type: 'settled',
      participant: result.participant,
    });

    if (result.isArchived) {
      this.server.to(`split:${conn.splitId}`).emit('split:archived', { splitId: conn.splitId });
    }
  }

  // ─── Broadcast helpers (called from controller) ───

  broadcastReceipt(splitId: string, receipt: any, message: any) {
    this.server.to(`split:${splitId}`).emit('split:receipt', { receipt, message });
  }

  broadcastReceiptUpdate(splitId: string, receipt: any) {
    this.server.to(`split:${splitId}`).emit('split:receipt:update', receipt);
  }

  broadcastParticipantJoined(splitId: string, participant: any) {
    this.server.to(`split:${splitId}`).emit('split:participant', {
      type: 'joined',
      participant,
    });
  }
}
