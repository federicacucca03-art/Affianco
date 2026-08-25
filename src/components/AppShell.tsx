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
      <div className="flex min-h-full bg-[var(--background)]">
        <BarraLaterale
          aperta={menuAperto}
          onChiudi={() => setMenuAperto(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <BarraSuperiore onApriMenu={() => setMenuAperto(true)} />
          <div className="flex-1 overflow-y-auto pb-8">{children}</div>
        </div>
      </div>
    </OnboardingCampagnaProvider>
  );
}
