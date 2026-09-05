"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { BarraSuperiore } from "@/components/BarraSuperiore";
import { OnboardingCampagnaProvider } from "@/components/OnboardingCampagnaContext";
import { AllySetupNavProvider } from "@/components/shell/AllySetupNavProvider";
import { IconRail } from "@/components/shell/IconRail";
import { SecondarySidebar } from "@/components/shell/SecondarySidebar";

type Props = {
  children: React.ReactNode;
};

type CanvasMode = "dotted" | "dotted-subtle" | "base";

function canvasModeForPath(pathname: string): CanvasMode {
  if (pathname === "/home") return "dotted";
  if (pathname === "/campagne" || pathname.startsWith("/campagne/")) {
    return "dotted";
  }
  if (pathname.startsWith("/risultati")) {
    /* Same Ally dotted canvas; dense metrics stay inside white surfaces. */
    return "dotted";
  }
  if (
    pathname.startsWith("/clienti") ||
    pathname.startsWith("/notifiche") ||
    pathname.startsWith("/impostazioni")
  ) {
    return "dotted-subtle";
  }
  return "base";
}

function canvasClass(mode: CanvasMode): string {
  switch (mode) {
    case "dotted":
      return "aff-dotted-canvas";
    case "dotted-subtle":
      return "aff-dotted-canvas--subtle";
    case "base":
      return "bg-[var(--ally-canvas)]";
  }
}

export function AppShell({ children }: Props) {
  const [menuAperto, setMenuAperto] = useState(false);
  const pathname = usePathname();
  const mode = canvasModeForPath(pathname);

  return (
    <OnboardingCampagnaProvider>
      <AllySetupNavProvider>
        <div className="aff-app-shell flex">
          <IconRail />
          <SecondarySidebar
            aperta={menuAperto}
            onChiudi={() => setMenuAperto(false)}
          />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <BarraSuperiore onApriMenu={() => setMenuAperto(true)} />
            <div
              className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${canvasClass(mode)}`}
            >
              <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
                {children}
              </div>
            </div>
          </div>
        </div>
      </AllySetupNavProvider>
    </OnboardingCampagnaProvider>
  );
}
