// Auth context for StockSense — backed by the real API.
// Session restore: on load we try /auth/refresh (httpOnly cookie); the access token stays in memory.
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { User } from '../types';
import { auth } from '../api';
import { refreshSession, setAccessToken, setSessionLostHandler } from '../api/client';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  /** True until the initial session restore finishes; don't redirect to /login while this is set. */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, role: string) => Promise<void>;
  logout: () => void;
  /** Replace the cached user after a profile edit so the sidebar/topbar update immediately. */
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setSessionLostHandler(() => setUser(null));
    refreshSession()
      .then(s => setUser(s?.user ?? null))
      .finally(() => setIsLoading(false));
    return () => setSessionLostHandler(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const s = await auth.login(email, password);
    setUser(s.user);
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string, role: string) => {
    const s = await auth.signup(name, email, password, role);
    setUser(s.user);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    auth.logout().catch(() => {}); // cookie is cleared server-side; nothing to do if it fails
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, signup, logout, updateUser: setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
