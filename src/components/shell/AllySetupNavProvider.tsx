"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import type { AllySetupPhase } from "@/lib/ally-setup";
import {
  buildAllyNavPresentation,
  type AllyNavPresentation,
} from "@/lib/ally-nav";
import {
  ALLY_SETUP_CHANGED_EVENT,
  loadAllySetupPhaseForShell,
} from "@/lib/ally-setup-shell-loader";

type AllySetupNavContextValue = {
  phase: AllySetupPhase | null;
  nav: AllyNavPresentation;
  refresh: () => Promise<void>;
};

const AllySetupNavContext = createContext<AllySetupNavContextValue | null>(
  null,
);

export function AllySetupNavProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [phase, setPhase] = useState<AllySetupPhase | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await loadAllySetupPhaseForShell(user?.id);
      setPhase(next);
    } catch {
      /* Keep last known / null → full nav while uncertain. */
    }
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh, pathname]);

  useEffect(() => {
    const onChanged = () => {
      void refresh();
    };
    window.addEventListener(ALLY_SETUP_CHANGED_EVENT, onChanged);
    return () => {
      window.removeEventListener(ALLY_SETUP_CHANGED_EVENT, onChanged);
    };
  }, [refresh]);

  const nav = useMemo(() => buildAllyNavPresentation(phase), [phase]);

  const value = useMemo(
    () => ({ phase, nav, refresh }),
    [phase, nav, refresh],
  );

  return (
    <AllySetupNavContext.Provider value={value}>
      {children}
    </AllySetupNavContext.Provider>
  );
}

export function useAllySetupNav(): AllySetupNavContextValue {
  const ctx = useContext(AllySetupNavContext);
  if (!ctx) {
    return {
      phase: null,
      nav: buildAllyNavPresentation(null),
      refresh: async () => {},
    };
  }
  return ctx;
}
