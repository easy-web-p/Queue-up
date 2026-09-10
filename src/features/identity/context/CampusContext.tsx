/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState } from "react";
import { CampusInfo, CAMPUS_PRESETS } from "./campusTypes";

export type { CampusInfo };
export { CAMPUS_PRESETS };

interface CampusContextType {
  activeCampus: CampusInfo;
  availableCampuses: CampusInfo[];
  selectCampus: (campusId: string) => void;
  isSwitcherOpen: boolean;
  setIsSwitcherOpen: (open: boolean) => void;
}

const CampusContext = createContext<CampusContextType | null>(null);

const STORAGE_KEY = "queueup_active_campus_id";

export const CampusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeCampusId, setActiveCampusId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && CAMPUS_PRESETS.some((c) => c.id === saved)) {
        return saved;
      }
    } catch {
      // Ignore localStorage access errors
    }
    return CAMPUS_PRESETS[0].id;
  });

  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);

  const activeCampus =
    CAMPUS_PRESETS.find((c) => c.id === activeCampusId) || CAMPUS_PRESETS[0];

  const selectCampus = (campusId: string) => {
    if (CAMPUS_PRESETS.some((c) => c.id === campusId)) {
      setActiveCampusId(campusId);
      try {
        localStorage.setItem(STORAGE_KEY, campusId);
        document.cookie = `queueup_campus_id=${campusId}; path=/; max-age=31536000; SameSite=Lax`;
      } catch {
        // Ignore storage errors
      }
      setIsSwitcherOpen(false);
    }
  };

  return (
    <CampusContext.Provider
      value={{
        activeCampus,
        availableCampuses: CAMPUS_PRESETS,
        selectCampus,
        isSwitcherOpen,
        setIsSwitcherOpen,
      }}
    >
      {children}
    </CampusContext.Provider>
  );
};

export function useCampus() {
  const ctx = useContext(CampusContext);
  if (!ctx) {
    throw new Error("useCampus must be used within a CampusProvider");
  }
  return ctx;
}
