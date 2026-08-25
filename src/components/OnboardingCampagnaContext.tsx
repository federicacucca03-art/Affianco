"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { ModaleConfiguraCampagna } from "@/components/ModaleConfiguraCampagna";

type ContestoOnboarding = {
  apriModaleCampagna: () => void;
};

const OnboardingCampagnaContext = createContext<ContestoOnboarding | null>(
  null,
);

export function useOnboardingCampagna() {
  const contesto = useContext(OnboardingCampagnaContext);
  if (!contesto) {
    throw new Error(
      "useOnboardingCampagna va usato dentro OnboardingCampagnaProvider",
    );
  }
  return contesto;
}

export function OnboardingCampagnaProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [modaleAperta, setModaleAperta] = useState(false);

  const apriModaleCampagna = useCallback(() => {
    setModaleAperta(true);
  }, []);

  const value = useMemo(
    () => ({ apriModaleCampagna }),
    [apriModaleCampagna],
  );

  return (
    <OnboardingCampagnaContext.Provider value={value}>
      {children}
      <ModaleConfiguraCampagna
        aperta={modaleAperta}
        onChiudi={() => setModaleAperta(false)}
      />
    </OnboardingCampagnaContext.Provider>
  );
}
