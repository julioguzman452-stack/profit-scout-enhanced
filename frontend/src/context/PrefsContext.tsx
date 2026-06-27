import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api } from "@/src/api/client";
import { storage } from "@/src/utils/storage";
import { CURRENCIES, getPalette, type Palette, type ThemeMode } from "@/src/theme";

const THEME_KEY = "ps_theme";
const CURRENCY_KEY = "ps_currency";

type Prefs = {
  mode: ThemeMode;
  currency: string;
  notificationsEnabled: boolean;
  colors: Palette;
  symbol: string;
  setMode: (m: ThemeMode) => Promise<void>;
  setCurrency: (c: string) => Promise<void>;
  setNotificationsEnabled: (b: boolean) => Promise<void>;
};

const Ctx = createContext<Prefs | undefined>(undefined);

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [currency, setCurrencyState] = useState<string>("USD");
  const [notif, setNotif] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      const m = (await storage.getItem(THEME_KEY, "light")) as ThemeMode | null;
      const c = (await storage.getItem(CURRENCY_KEY, "USD")) as string | null;
      if (m === "dark" || m === "light") setModeState(m);
      if (c) setCurrencyState(c);
      // Best-effort sync from server (silent fail)
      try {
        const remote = await api<{ theme?: ThemeMode; currency?: string; notifications_enabled?: boolean }>(
          "/settings",
        );
        if (remote.theme === "dark" || remote.theme === "light") setModeState(remote.theme);
        if (remote.currency) setCurrencyState(remote.currency);
        if (typeof remote.notifications_enabled === "boolean") setNotif(remote.notifications_enabled);
      } catch {}
    })();
  }, []);

  const setMode = useCallback(async (m: ThemeMode) => {
    setModeState(m);
    await storage.setItem(THEME_KEY, m);
    try {
      await api("/settings", { method: "POST", body: { theme: m } });
    } catch {}
  }, []);

  const setCurrency = useCallback(async (c: string) => {
    setCurrencyState(c);
    await storage.setItem(CURRENCY_KEY, c);
    try {
      await api("/settings", { method: "POST", body: { currency: c } });
    } catch {}
  }, []);

  const setNotificationsEnabled = useCallback(async (b: boolean) => {
    setNotif(b);
    try {
      await api("/settings", { method: "POST", body: { notifications_enabled: b } });
    } catch {}
  }, []);

  const symbol = useMemo(
    () => CURRENCIES.find((c) => c.code === currency)?.symbol || "$",
    [currency],
  );
  const colors = useMemo(() => getPalette(mode), [mode]);

  const value: Prefs = {
    mode,
    currency,
    notificationsEnabled: notif,
    colors,
    symbol,
    setMode,
    setCurrency,
    setNotificationsEnabled,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): Prefs {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePrefs must be inside PrefsProvider");
  return c;
}

export const useColors = () => usePrefs().colors;
export const useCurrency = () => ({ code: usePrefs().currency, symbol: usePrefs().symbol });
