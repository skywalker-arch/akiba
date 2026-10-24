import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "../lib/auth-storage";
import { authApi } from "../lib/api";

type AuthContextValue = {
  token: string | null;
  isAuthenticated: boolean;
  isCheckingSession: boolean;

  login: (nextToken: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getAccessToken());
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    const savedToken = getAccessToken();

    if (!savedToken) {
      setIsCheckingSession(false);
      return;
    }

    let isMounted = true;

    authApi
      .me(savedToken)
      .catch(() => {
        if (!isMounted) {
          return;
        }

        clearAccessToken();
        setToken(null);
      })
      .finally(() => {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      isCheckingSession,
      login: (nextToken: string) => {
        setAccessToken(nextToken);
        setToken(nextToken);
        setIsCheckingSession(false);
      },
      logout: () => {
        clearAccessToken();
        setToken(null);
        setIsCheckingSession(false);
      },
    }),
    [isCheckingSession, token],
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
