import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";
import { api, configureApi } from "../api/client";
import type { Me } from "../api/types";

const TOKEN_KEY = "hh_token";

type AuthState = {
  ready: boolean;
  token: string | null;
  me: Me | null;
  setSession: (token: string) => Promise<Me | null>;
  refreshMe: () => Promise<Me | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    configureApi({
      getToken: () => tokenRef.current,
      onUnauthorized: () => {
        tokenRef.current = null;
        void SecureStore.deleteItemAsync(TOKEN_KEY);
        setToken(null);
        setMe(null);
      },
    });
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const data = await api<Me>("/api/auth/me");
      setMe(data);
      return data;
    } catch {
      setMe(null);
      return null;
    }
  }, []);

  const setSession = useCallback(
    async (next: string) => {
      tokenRef.current = next;
      await SecureStore.setItemAsync(TOKEN_KEY, next);
      setToken(next);
      return refreshMe();
    },
    [refreshMe]
  );

  const logout = useCallback(async () => {
    try {
      if (tokenRef.current) {
        await api("/api/auth/logout", { method: "POST", body: "{}" });
      }
    } catch {
      /* ignore */
    }
    tokenRef.current = null;
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setMe(null);
  }, []);

  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync(TOKEN_KEY);
      if (stored) {
        tokenRef.current = stored;
        setToken(stored);
        try {
          const data = await api<Me>("/api/auth/me");
          setMe(data);
        } catch {
          tokenRef.current = null;
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          setToken(null);
        }
      }
      setReady(true);
    })();
  }, []);

  const value = useMemo(
    () => ({ ready, token, me, setSession, refreshMe, logout }),
    [ready, token, me, setSession, refreshMe, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}
