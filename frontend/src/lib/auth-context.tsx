'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from '@/lib/api';
import type { IUser, ILoginRequest, IRegisterRequest } from '@shared/auth';

interface IAuthContext {
  user: IUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionError: boolean;
  retrySession: () => void;
  login: (input: ILoginRequest) => Promise<void>;
  register: (input: IRegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<IAuthContext | undefined>(undefined);

interface Props {
  children: ReactNode;
}

export function AuthProvider({ children }: Props) {
  const [user, setUser] = useState<IUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionError, setSessionError] = useState(false);

  const loadSession = useCallback(() => {
    setIsLoading(true);
    setSessionError(false);

    api
      .getSession()
      .then((session) => {
        api.setCsrfToken(session.csrfToken);

        if (session.authenticated && session.user) {
          setUser(session.user);
        } else {
          // Session expired — clear stale cookie
          document.cookie = 'financio.sid=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          setUser(null);
        }
      })
      .catch(() => {
        // Session check failed — clear stale cookie
        document.cookie = 'financio.sid=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        setUser(null);
        setSessionError(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const retrySession = useCallback(() => {
    loadSession();
  }, [loadSession]);

  const login = useCallback(async (input: ILoginRequest) => {
    const response = await api.login(input);
    api.setCsrfToken(response.csrfToken);
    setUser(response.user);
  }, []);

  const register = useCallback(async (input: IRegisterRequest) => {
    const response = await api.register(input);
    api.setCsrfToken(response.csrfToken);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Ignore logout errors
    }

    document.cookie = 'financio.sid=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    setUser(null);
  }, []);

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated, sessionError, retrySession, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = (): IAuthContext => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};
