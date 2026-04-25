'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setAccessToken } from './api';
import type { UserPublic } from '@octera/shared';

interface AuthContextValue {
  user: UserPublic | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Splice an updated UserPublic into the cached state — used after a
   * profile-edit endpoint (e.g. PATCH /v1/users/me) returns the new
   * shape, so we don't need a refetch round-trip to update the UI.
   */
  updateUser: (next: UserPublic) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthResponse {
  accessToken: string;
  user: UserPublic;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate session on first render: try to refresh using the httpOnly cookie.
  useEffect(() => {
    (async () => {
      try {
        const data = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/v1/auth/refresh`,
          { method: 'POST', credentials: 'include' }
        );
        if (data.ok) {
          const parsed = (await data.json()) as AuthResponse;
          setAccessToken(parsed.accessToken);
          setUser(parsed.user);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api<AuthResponse>('/v1/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    setAccessToken(res.accessToken);
    setUser(res.user);
  };

  const signup = async (email: string, password: string, fullName?: string) => {
    const res = await api<AuthResponse>('/v1/auth/signup', {
      method: 'POST',
      body: { email, password, fullName },
      auth: false,
    });
    setAccessToken(res.accessToken);
    setUser(res.user);
  };

  const logout = async () => {
    await api('/v1/auth/logout', { method: 'POST', auth: false }).catch(() => undefined);
    setAccessToken(null);
    setUser(null);
  };

  const updateUser = (next: UserPublic) => setUser(next);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
