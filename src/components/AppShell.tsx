"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { BarraSuperiore } from "@/components/BarraSuperiore";
import { OnboardingCampagnaProvider } from "@/components/OnboardingCampagnaContext";
import { IconRail } from "@/components/shell/IconRail";
import { SecondarySidebar } from "@/components/shell/SecondarySidebar";

type Props = {
  children: React.ReactNode;
};

export function AppShell({ children }: Props) {
  const [menuAperto, setMenuAperto] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/home";

  return (
    <OnboardingCampagnaProvider>
      <div className="aff-app-shell flex">
        <IconRail />
        <SecondarySidebar
          aperta={menuAperto}
          onChiudi={() => setMenuAperto(false)}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <BarraSuperiore onApriMenu={() => setMenuAperto(true)} />
          <div
            className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${
              isHome ? "aff-workspace-dots" : "bg-[var(--workspace)]"
            }`}
          >
            <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
              {children}
            </div>
          </div>
        </div>
      </div>
    </OnboardingCampagnaProvider>
  );
}
