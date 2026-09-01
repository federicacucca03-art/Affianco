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
      <div className="aff-app-shell flex min-h-dvh md:gap-3 md:p-3">
        <BarraLaterale
          aperta={menuAperto}
          onChiudi={() => setMenuAperto(false)}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <BarraSuperiore onApriMenu={() => setMenuAperto(true)} />
          <div className="aff-workspace mx-3 mb-3 min-h-0 flex-1 overflow-y-auto px-5 py-7 sm:px-8 sm:py-8 md:mx-0 md:mb-0 lg:px-10">
            {children}
          </div>
        </div>
      </div>
    </OnboardingCampagnaProvider>
  );
}
