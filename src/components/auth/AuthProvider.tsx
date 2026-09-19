"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { clearAllySessionUiForUser } from "@/lib/ally-session-ui";

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
  const lastUserIdRef = useRef<string | null>(null);

  const syncFromSession = useCallback((next: Session | null) => {
    setSession(next);
    setUser(next?.user ?? null);
  }, []);

  useEffect(() => {
    if (user?.id) lastUserIdRef.current = user.id;
  }, [user?.id]);

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
      (event, nextSession) => {
        if (!attivo) return;
        if (event === "SIGNED_OUT" && lastUserIdRef.current) {
          clearAllySessionUiForUser(lastUserIdRef.current);
          lastUserIdRef.current = null;
        }
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
    const uid = lastUserIdRef.current ?? user?.id ?? null;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    if (uid) clearAllySessionUiForUser(uid);
    lastUserIdRef.current = null;
    syncFromSession(null);
  }, [syncFromSession, user?.id]);

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
