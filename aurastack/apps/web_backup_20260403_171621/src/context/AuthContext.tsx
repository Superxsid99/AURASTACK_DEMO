import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  type AuthUser,
  clearAuthTokens,
  getMe,
  login as loginApi,
  logout as logoutApi,
  registerUnauthorizedHandler,
  restoreAuthTokens,
  setAuthTokens
} from "../lib/api";

interface AuthContextType {
  user: AuthUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      clearAuthTokens();
      setUser(null);
    });
    return () => registerUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    const initialize = async () => {
      const restored = restoreAuthTokens();
      if (!restored) {
        setReady(true);
        return;
      }
      try {
        const me = await getMe();
        setUser(me);
      } catch {
        clearAuthTokens();
        setUser(null);
      } finally {
        setReady(true);
      }
    };
    void initialize();
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user,
    ready,
    login: async (email: string, password: string) => {
      const session = await loginApi({ email, password });
      setAuthTokens({ token: session.token, refreshToken: session.refreshToken });
      setUser(session.user);
    },
    logout: async () => {
      try {
        await logoutApi();
      } catch {
        // best effort logout; local session is always cleared
      }
      clearAuthTokens();
      setUser(null);
    }
  }), [ready, user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
