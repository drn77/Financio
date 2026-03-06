import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthActionsService } from './auth-actions.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { IUser } from '../../shared/models/auth';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthContextService {
  constructor(private readonly authActions: AuthActionsService) {}

  // #region Create
  async register(input: RegisterDto): Promise<IUser> {
    const existingEmail = await this.authActions.findUserByEmail(input.email);

    if (existingEmail) {
      throw new ConflictException('User with this email already exists');
    }

    const existingUsername = await this.authActions.findUserByUsername(input.username);

    if (existingUsername) {
      throw new ConflictException('Username is already taken');
    }

    const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

    const { user, familyId, familyRole } = await this.authActions.createUserWithFamily({
      username: input.username,
      email: input.email,
      password: hashedPassword,
      firstName: input.firstName,
      lastName: input.lastName,
    });

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      familyId,
      familyRole,
    };
  }
  // #endregion

  // #region Read
  async login(input: LoginDto): Promise<IUser> {
    const user = await this.authActions.findUserByUsername(input.username);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const membership = await this.authActions.findFamilyMembership(user.id);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      familyId: membership?.familyId ?? null,
      familyRole: membership?.role ?? null,
    };
  }

  async getProfile(userId: string): Promise<IUser> {
    const user = await this.authActions.findUserById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const membership = await this.authActions.findFamilyMembership(user.id);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      familyId: membership?.familyId ?? null,
      familyRole: membership?.role ?? null,
    };
  }
  // #endregion

  // #region Update
  // #endregion

  // #region Delete
  // #endregion

  // #region Misc
  // #endregion
}
