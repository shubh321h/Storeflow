import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { User } from '../lib/types';
import { createUser, getUserByEmail, getUserById } from '../lib/database';
import { generateId } from '../lib/utils';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_KEY = 'storeflow_auth_user_id';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      const userId = await SecureStore.getItemAsync(AUTH_KEY);
      if (userId) {
        const u = await getUserById(userId);
        if (u) setUser(u);
      }
    } catch (e) {
      console.error('Auth load error', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const u = await getUserByEmail(email.toLowerCase().trim());
      if (!u) return { success: false, error: 'Account not found. Please register.' };
      if (u.passwordHash !== hashPassword(password)) {
        return { success: false, error: 'Incorrect password. Please try again.' };
      }
      await SecureStore.setItemAsync(AUTH_KEY, u.id);
      setUser(u);
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Something went wrong. Please try again.' };
    }
  }

  async function register(name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await getUserByEmail(email.toLowerCase().trim());
      if (existing) return { success: false, error: 'An account with this email already exists.' };
      if (password.length < 6) return { success: false, error: 'Password must be at least 6 characters.' };

      const user: User = {
        id: generateId(),
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await createUser(user);
      await SecureStore.setItemAsync(AUTH_KEY, user.id);
      setUser(user);
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Something went wrong. Please try again.' };
    }
  }

  async function logout() {
    await SecureStore.deleteItemAsync(AUTH_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}
