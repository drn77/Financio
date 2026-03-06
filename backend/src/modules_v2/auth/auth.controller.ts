import { Body, Controller, Get, Post, Req, Res, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { AuthContextService } from './auth-context.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SessionAuthGuard } from '../../shared/guards/auth.guard';
import { IUser, ISessionResponse } from '../../shared/models/auth';

@Controller('v2/auth')
export class AuthController {
  constructor(private readonly authContext: AuthContextService) {}

  @Get('session')
  async getSession(@Req() req: Request): Promise<ISessionResponse> {
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }

    if (req.session.userId) {
      try {
        const user = await this.authContext.getProfile(req.session.userId);

        return {
          authenticated: true,
          user,
          csrfToken: req.session.csrfToken,
        };
      } catch {
        return {
          authenticated: false,
          user: null,
          csrfToken: req.session.csrfToken,
        };
      }
    }

    return {
      authenticated: false,
      user: null,
      csrfToken: req.session.csrfToken,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() input: LoginDto, @Req() req: Request): Promise<{ user: IUser; csrfToken: string }> {
    const user = await this.authContext.login(input);

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    req.session.familyId = user.familyId ?? undefined;
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');

    return { user, csrfToken: req.session.csrfToken! };
  }

  @Post('register')
  async register(@Body() input: RegisterDto, @Req() req: Request): Promise<{ user: IUser; csrfToken: string }> {
    const user = await this.authContext.register(input);

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    req.session.familyId = user.familyId ?? undefined;
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');

    return { user, csrfToken: req.session.csrfToken! };
  }

  @Post('logout')
  @UseGuards(SessionAuthGuard)
  @HttpCode(HttpStatus.OK)
  logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    return new Promise((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) {
          return reject(err);
        }

        res.clearCookie('financio.sid');
        resolve({ message: 'Logged out successfully' });
      });
    });
  }

  @Get('profile')
  @UseGuards(SessionAuthGuard)
  async getProfile(@Req() req: Request): Promise<{ user: IUser }> {
    const user = await this.authContext.getProfile(req.session.userId!);

    return { user };
  }
}
