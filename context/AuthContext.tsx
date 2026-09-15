import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Linking } from 'react-native';
import { AuthError, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User } from '../lib/types';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

// Single source of truth for the deep link Supabase should send users back
// to, for BOTH the email-confirmation flow and the Google OAuth flow.
// Resolves to "storeflow://auth/callback" in the built Android app (the
// "storeflow" scheme comes from app.json's top-level "scheme" field).
// Without explicitly passing this as `emailRedirectTo`/`redirectTo`,
// Supabase falls back to the project's Dashboard "Site URL", which is
// "http://localhost:3000" by default on every new Supabase project.
//
// NOTE: this must be `AuthSession.makeRedirectUri` (URI) — there is no
// `makeRedirectUrl` export in expo-auth-session; calling that throws at
// import time and crashes the app before anything else can render.
const AUTH_REDIRECT_TO = AuthSession.makeRedirectUri({
  scheme: 'storeflow',
  path: 'auth/callback',
});

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
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

    // Email confirmation links are opened by the OS (mail app / browser)
    // OUTSIDE of WebBrowser.openAuthSessionAsync, so unlike Google sign-in
    // (which captures its own redirect result directly), we need a plain
    // `Linking` listener here to catch "storeflow://auth/callback?code=..."
    // whenever the OS hands that URL to the app, and finish the session.
    //
    // supabase.auth is configured with `detectSessionInUrl: false` (correct
    // for React Native, since there is no `window.location` to read), so
    // without this listener nothing would ever consume that incoming URL.
    async function handleIncomingUrl(url: string | null) {
      if (!url || !mounted) return;

      let code: string | null = null;

      try {
        code = new URL(url).searchParams.get('code');
      } catch {
        return;
      }

      if (!code) return;

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('Email confirmation session exchange failed', error);
      }
    }

    // App was opened cold, directly via the deep link (e.g. tapping the
    // confirmation link when StoreFlow wasn't already running).
    void Linking.getInitialURL().then(handleIncomingUrl);

    // App was already running in the background and got resumed via the
    // deep link.
    const urlSubscription = Linking.addEventListener('url', ({ url }) => {
      void handleIncomingUrl(url);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      urlSubscription.remove();
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
        options: {
          data: { name: name.trim() },
          emailRedirectTo: AUTH_REDIRECT_TO,
        },
      });
      if (error) return { success: false, error: authErrorMessage(error) };
      if (!data.session) return { success: false, error: 'Please confirm your email before signing in.' };
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Something went wrong. Please try again.' };
    }
  }

  async function loginWithGoogle() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: AUTH_REDIRECT_TO,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        return { success: false, error: authErrorMessage(error) };
      }

      if (!data?.url) {
        return { success: false, error: 'Unable to start Google sign-in.' };
      }

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        AUTH_REDIRECT_TO
      );

      if (result.type !== 'success' || !result.url) {
        if (result.type === 'cancel' || result.type === 'dismiss') {
          return { success: false, error: 'Google sign-in was cancelled.' };
        }

        return { success: false, error: 'Google sign-in failed.' };
      }

      const url = new URL(result.url);
      const code = url.searchParams.get('code');

      if (!code) {
        return { success: false, error: 'Google sign-in did not return a session.' };
      }

      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        return {
          success: false,
          error: authErrorMessage(exchangeError),
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Google sign-in failed. Please try again.',
      };
    }
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        loginWithGoogle,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be inside AuthProvider');
  return context;
}
