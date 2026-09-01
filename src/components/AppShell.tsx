"use client";

import { useState } from "react";
import { BarraLaterale } from "@/components/BarraLaterale";
import { BarraSuperiore } from "@/components/BarraSuperiore";
import { OnboardingCampagnaProvider } from "@/components/OnboardingCampagnaContext";

type Props = {
  children: React.ReactNode;
};

export function AppShell({ children }: Props) {
  const [menuAperto, setMenuAperto] = useState(false);

  return (
    <OnboardingCampagnaProvider>
      <div className="aff-app-shell flex h-dvh max-h-dvh min-h-0 overflow-hidden md:gap-3 md:p-3">
        <BarraLaterale
          aperta={menuAperto}
          onChiudi={() => setMenuAperto(false)}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <BarraSuperiore onApriMenu={() => setMenuAperto(true)} />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col px-3 pb-3 md:px-0 md:pb-0">
            <div className="aff-workspace min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-7 sm:px-8 sm:py-8 lg:px-10">
              {children}
            </div>
          </div>
        </div>
      </div>
    </OnboardingCampagnaProvider>
  );
}
