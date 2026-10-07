'use client';
// Signed-in user, their company and what their role may do
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, api, tokenStore, tenantStore } from './api';

export type Action = 'view' | 'create' | 'edit' | 'delete' | 'approve';
export interface Profile {
  id: number; name: string; email: string; title: string; initials: string;
  role: { id: number; key: string; name: string; tier: string };
  company: { id: number; code: string; name: string; shortName: string; industry: string; city: string; gstin?: string | null };
  branches: Array<{ id: number; code: string; name: string; isMain: boolean }>;
  permissions: Record<string, Record<Action, boolean>>;
}
interface AuthState {
  user: Profile | null;
  status: 'loading' | 'signed-in' | 'signed-out';
  login: (email: string, password: string, tenantSlug?: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  can: (module: string, action?: Action) => boolean;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [status, setStatus] = useState<AuthState['status']>('loading');

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) { setUser(null); setStatus('signed-out'); return; }
    try {
      setUser(await api<Profile>('/auth/me'));
      setStatus('signed-in');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) tokenStore.clear();
      setUser(null);
      setStatus('signed-out');
    }
  }, []);

  useEffect(() => {
    refresh();
    const out = () => { setUser(null); setStatus('signed-out'); };
    window.addEventListener('kcerp:signed-out', out);
    return () => window.removeEventListener('kcerp:signed-out', out);
  }, [refresh]);

  const login = useCallback(async (email: string, password: string, tenantSlug?: string) => {
    // If a slug is provided (from URL), store it so api() can prefix all calls with /{slug}
    if (tenantSlug) tenantStore.set(tenantSlug);
    const r = await api<{ token: string; user: Profile }>('/auth/login', { method: 'POST', body: { email, password } });
    tokenStore.set(r.token);
    setUser(r.user);
    setStatus('signed-in');
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    tenantStore.clear();
    setUser(null);
    setStatus('signed-out');
  }, []);

  const can = useCallback((module: string, action: Action = 'view') => !!user?.permissions?.[module]?.[action], [user]);

  const value = useMemo(() => ({ user, status, login, logout, refresh, can }), [user, status, login, logout, refresh, can]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
