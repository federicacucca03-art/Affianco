"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  email: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const syncFromSession = useCallback((next: Session | null) => {
    setSession(next);
    setUser(next?.user ?? null);
  }, []);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      syncFromSession(null);
      return;
    }
    syncFromSession(data.session);
  }, [syncFromSession]);

  useEffect(() => {
    let attivo = true;

    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!attivo) return;
        syncFromSession(data.session);
      } catch {
        if (!attivo) return;
        syncFromSession(null);
      } finally {
        if (attivo) setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!attivo) return;
        syncFromSession(nextSession);
        setLoading(false);
      },
    );

    return () => {
      attivo = false;
      sub.subscription.unsubscribe();
    };
  }, [syncFromSession]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    syncFromSession(null);
  }, [syncFromSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      email: user?.email ?? null,
      refresh,
      signOut,
    }),
    [user, session, loading, refresh, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve essere usato dentro AuthProvider");
  }
  return ctx;
}
