import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface Prefs {
  dark: boolean;
  muted: boolean;
  name: string;
  setDark: (v: boolean) => void;
  setMuted: (v: boolean) => void;
  setName: (v: string) => void;
}

const PrefsContext = createContext<Prefs | null>(null);
const KEY = "spotto-prefs";

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);
  const [muted, setMuted] = useState(false);
  const [name, setName] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        setDark(!!p.dark);
        setMuted(!!p.muted);
        setName(typeof p.name === "string" ? p.name : "");
      } else {
        setDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
      }
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    if (loaded) localStorage.setItem(KEY, JSON.stringify({ dark, muted, name }));
  }, [dark, muted, name, loaded]);

  return (
    <PrefsContext.Provider value={{ dark, muted, name, setDark, setMuted, setName }}>
      {children}
    </PrefsContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePreferences must be used inside PreferencesProvider");
  return ctx;
}
