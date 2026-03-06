export type UserRole = 'USER' | 'ADMIN';

export interface IUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  firstName: string | null;
  lastName: string | null;
  familyId: string | null;
  familyRole: string | null;
}

export interface ISessionResponse {
  authenticated: boolean;
  user: IUser | null;
  csrfToken: string;
}

export interface IAuthResponse {
  user: IUser;
}

export interface ILoginRequest {
  username: string;
  password: string;
}

export interface IRegisterRequest {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}
