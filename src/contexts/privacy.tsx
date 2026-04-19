"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface PrivacyContextType {
  isPrivate: boolean;
  toggle: () => void;
}

const PrivacyContext = createContext<PrivacyContextType>({
  isPrivate: false,
  toggle: () => {},
});

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("pvg_privacy_mode");
    if (stored === "true") setIsPrivate(true);
  }, []);

  function toggle() {
    setIsPrivate((v) => {
      const next = !v;
      localStorage.setItem("pvg_privacy_mode", String(next));
      return next;
    });
  }

  return (
    <PrivacyContext.Provider value={{ isPrivate, toggle }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  return useContext(PrivacyContext);
}
