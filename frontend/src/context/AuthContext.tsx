import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  api,
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from "@/src/api/client";

type User = { id: string; email: string } | null;

type AuthCtx = {
  user: User;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await getStoredToken();
        if (!token) {
          setLoading(false);
          return;
        }
        const me = await api<{ id: string; email: string }>("/auth/me");
        setUser({ id: me.id, email: me.email });
      } catch {
        await clearStoredToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const r = await api<{ access_token: string; user: { id: string; email: string } }>(
      "/auth/login",
      { method: "POST", body: { email, password } },
    );
    await setStoredToken(r.access_token);
    setUser(r.user);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const r = await api<{ access_token: string; user: { id: string; email: string } }>(
      "/auth/register",
      { method: "POST", body: { email, password } },
    );
    await setStoredToken(r.access_token);
    setUser(r.user);
  }, []);

  const signOut = useCallback(async () => {
    await clearStoredToken();
    setUser(null);
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
}
