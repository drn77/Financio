'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
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
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRetryTimer = () => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  const isConnectivityError = (error: unknown): boolean => {
    if (!(error instanceof Error)) return true;
    const message = (error.message || '').toLowerCase();
    if (message.startsWith('http 401') || message.startsWith('http 403')) return false;
    if (message.startsWith('http ')) return false;
    return true;
  };

  const loadSession = useCallback(async (attempt = 0) => {
    if (attempt === 0) {
      setIsLoading(true);
      setSessionError(false);
      clearRetryTimer();
    }

    try {
      const session = await api.getSession();
      api.setCsrfToken(session.csrfToken);

      if (session.authenticated && session.user) {
        setUser(session.user);
      } else {
        document.cookie = 'financio.sid=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        setUser(null);
      }
      setSessionError(false);
    } catch (error) {
      const connectivityIssue = isConnectivityError(error);

      // For transient network/backend hiccups, retry before showing fatal screen.
      if (connectivityIssue && attempt < 2) {
        const delay = 1000 * (attempt + 1);
        retryTimerRef.current = setTimeout(() => {
          void loadSession(attempt + 1);
        }, delay);
        return;
      }

      // For auth/session problems, redirect to login flow without cache-clearing UX.
      if (!connectivityIssue) {
        document.cookie = 'financio.sid=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        setUser(null);
        setSessionError(false);
      } else {
        // Keep current user state untouched on connectivity issues to avoid forced logout loops.
        setSessionError(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
    return () => {
      clearRetryTimer();
    };
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
