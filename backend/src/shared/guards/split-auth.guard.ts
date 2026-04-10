import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Guard that authenticates both registered users and split guests.
 * Checks (in order):
 *   1. Session userId → find participant by userId + splitId
 *   2. X-Split-Token header → find participant by guestToken
 * Attaches `splitParticipantId` and `splitId` to request for downstream use.
 */
@Injectable()
export class SplitAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const splitId = (request.params.splitId || request.params.id) as string;

    if (!splitId) {
      throw new ForbiddenException('Split ID is required');
    }

    // 1. Try session-based auth (registered user)
    if (request.session?.userId) {
      const participant = await this.prisma.splitParticipant.findFirst({
        where: { splitId, userId: request.session.userId as string },
      });

      if (participant) {
        (request as any).splitParticipantId = participant.id;
        (request as any).splitId = splitId;
        (request as any).splitIsAdmin = participant.isAdmin;
        return true;
      }
    }

    // 2. Try guest token auth
    const guestToken = request.headers['x-split-token'] as string | undefined;
    if (guestToken) {
      const participant = await this.prisma.splitParticipant.findUnique({
        where: { guestToken },
      });

      if (participant && participant.splitId === splitId) {
        (request as any).splitParticipantId = participant.id;
        (request as any).splitId = splitId;
        (request as any).splitIsAdmin = participant.isAdmin;
        return true;
      }
    }

    throw new UnauthorizedException('Not a participant of this split');
  }
}
