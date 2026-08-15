import { createContext, useContext, useMemo, useState } from "react";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "../lib/auth-storage";

type AuthContextValue = {
  token: string | null;
  isAuthenticated: boolean;
  login: (nextToken: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getAccessToken());

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      login: (nextToken: string) => {
        setAccessToken(nextToken);
        setToken(nextToken);
      },
      logout: () => {
        clearAccessToken();
        setToken(null);
      },
    }),
    [token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
