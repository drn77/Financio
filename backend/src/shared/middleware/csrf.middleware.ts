import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

const EXEMPT_PATHS = ['/api/v2/auth/login', '/api/v2/auth/register', '/api/auth/login', '/api/auth/register'];

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    if (SAFE_METHODS.includes(req.method)) {
      return next();
    }

    if (EXEMPT_PATHS.some((path) => req.originalUrl.startsWith(path))) {
      return next();
    }

    const headerToken = req.headers['x-csrf-token'] as string | undefined;
    const sessionToken = req.session?.csrfToken;

    if (!headerToken || !sessionToken || headerToken !== sessionToken) {
      throw new ForbiddenException('Invalid or missing CSRF token');
    }

    next();
  }
}
