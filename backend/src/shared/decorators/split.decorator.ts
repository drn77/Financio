import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';

export const SplitParticipantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const id = request.splitParticipantId;
    if (!id) throw new ForbiddenException('Not a participant');
    return id;
  },
);

export const SplitId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const id = request.splitId;
    if (!id) throw new ForbiddenException('Split ID not resolved');
    return id;
  },
);

export const SplitIsAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): boolean => {
    const request = ctx.switchToHttp().getRequest();
    return !!request.splitIsAdmin;
  },
);
