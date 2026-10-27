'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '@carsharing/contracts';
import { fetchCurrentUser, fetchCsrfToken, loginApi, logoutApi } from './api';

interface AuthContextValue {
  user: User | null;
  csrfToken: string;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [csrfToken, setCsrfToken] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const initAuth = useCallback(async () => {
    try {
      const [token, currentUser] = await Promise.all([
        fetchCsrfToken().catch(() => ''),
        fetchCurrentUser().catch(() => null),
      ]);
      setCsrfToken(token);
      setUser(currentUser);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const loggedInUser = await loginApi(email, password);
      const token = await fetchCsrfToken().catch(() => '');
      setCsrfToken(token);
      setUser(loggedInUser);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await logoutApi(csrfToken);
      setUser(null);
      const token = await fetchCsrfToken().catch(() => '');
      setCsrfToken(token);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    const currentUser = await fetchCurrentUser();
    setUser(currentUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        csrfToken,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
