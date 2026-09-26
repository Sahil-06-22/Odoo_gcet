// Auth context for StockSense
import React, { createContext, useContext, useState, useCallback } from 'react';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, _password: string) => Promise<void>;
  signup: (name: string, email: string, _password: string, role: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Mock user data
const MOCK_USER: User = {
  id: 'u1',
  name: 'Priya Sharma',
  email: 'priya@stocksense.io',
  role: 'INVENTORY_MANAGER',
  createdAt: '2024-01-01',
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = sessionStorage.getItem('ss_user');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return MOCK_USER;
      }
    }
    // Default to demo user for first session
    sessionStorage.setItem('ss_user', JSON.stringify(MOCK_USER));
    return MOCK_USER;
  });

  const login = useCallback(async (email: string, _password: string) => {
    // Simulate API call
    await new Promise(res => setTimeout(res, 800));
    const loggedUser = { ...MOCK_USER, email };
    setUser(loggedUser);
    sessionStorage.setItem('ss_user', JSON.stringify(loggedUser));
  }, []);

  const signup = useCallback(async (name: string, email: string, _password: string, role: string) => {
    await new Promise(res => setTimeout(res, 800));
    const newUser: User = {
      id: 'u-new',
      name,
      email,
      role: role as User['role'],
      createdAt: new Date().toISOString(),
    };
    setUser(newUser);
    sessionStorage.setItem('ss_user', JSON.stringify(newUser));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem('ss_user');
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
