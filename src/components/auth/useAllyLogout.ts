"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  logErroreAuthDev,
  messaggioErroreAuth,
} from "@/lib/auth-errori";

/**
 * Canonical Ally logout: AuthProvider.signOut → /login.
 * Shared by icon rail and header profile menu.
 */
export function useAllyLogout() {
  const { signOut, email } = useAuth();
  const router = useRouter();
  const [logoutErrore, setLogoutErrore] = useState<string | null>(null);
  const [logoutInCorso, setLogoutInCorso] = useState(false);

  const esci = useCallback(async () => {
    setLogoutErrore(null);
    setLogoutInCorso(true);
    try {
      await signOut();
      router.replace("/login");
    } catch (e) {
      logErroreAuthDev("logout", e);
      setLogoutErrore(messaggioErroreAuth(e, "logout"));
    } finally {
      setLogoutInCorso(false);
    }
  }, [signOut, router]);

  return { esci, logoutErrore, logoutInCorso, email };
}
