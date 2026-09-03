import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AuthError, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { User } from '../lib/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      const { data, error } = await supabase.auth.getSession();
      if (error) console.error('Auth session load error', error);
      if (mounted && data.session) setUser(await loadProfile(data.session.user));
      if (mounted) setIsLoading(false);
    }

    void restoreSession();
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        return;
      }
      void loadProfile(session.user).then((profile) => {
        if (mounted) setUser(profile);
      });
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function loadProfile(authUser: SupabaseUser): Promise<User> {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, name, email, created_at, updated_at')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error) console.error('Profile load error', error);

    return {
      id: authUser.id,
      name: profile?.name || authUser.user_metadata?.name || authUser.email || '',
      email: profile?.email || authUser.email || '',
      createdAt: profile?.created_at || authUser.created_at,
      updatedAt: profile?.updated_at || authUser.updated_at || authUser.created_at,
    };
  }

  function authErrorMessage(error: AuthError): string {
    const message = error.message.toLowerCase();
    if (message.includes('already registered')) return 'An account with this email already exists.';
    if (message.includes('invalid login credentials')) return 'Incorrect email or password. Please try again.';
    if (message.includes('email not confirmed')) return 'Please confirm your email before signing in.';
    return error.message || 'Something went wrong. Please try again.';
  }

  async function login(email: string, password: string) {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.toLowerCase().trim(), password });
      return error ? { success: false, error: authErrorMessage(error) } : { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Something went wrong. Please try again.' };
    }
  }

  async function register(name: string, email: string, password: string) {
    if (password.length < 6) return { success: false, error: 'Password must be at least 6 characters.' };
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: { data: { name: name.trim() } },
      });
      if (error) return { success: false, error: authErrorMessage(error) };
      if (!data.session) return { success: false, error: 'Please confirm your email before signing in.' };
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Something went wrong. Please try again.' };
    }
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  return <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be inside AuthProvider');
  return context;
}
