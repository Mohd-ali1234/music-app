import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { api, User } from "./api";
import { saveToken, deleteToken, getToken } from "./token";

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const tok = await getToken();
      if (tok) {
        try {
          const me = await api.get<User>("/auth/me");
          setUser(me);
        } catch {
          await deleteToken();
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ access_token: string; user: User }>(
      "/auth/login",
      { email, password },
    );
    await saveToken(res.access_token);
    setUser(res.user);
  }, []);

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      const res = await api.post<{ access_token: string; user: User }>(
        "/auth/register",
        { email, password, name },
      );
      await saveToken(res.access_token);
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    await deleteToken();
    setUser(null);
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside provider");
  return v;
}
