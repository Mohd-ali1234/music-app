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
  register: (email: string, password: string, name?: string, preferences?: MusicPreferences) => Promise<void>;
  logout: () => Promise<void>;
};

export type MusicPreferences = {
  favorite_artists: string[]; genres: string[]; languages: string[]; moods: string[]; decades: string[];
};

type AuthResponse = {
  token: string;
  user: User;
};

type CurrentUserResponse = {
  user: User;
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
          const { user } = await api.get<CurrentUserResponse>("/auth/me");
          setUser(user);
        } catch {
          await deleteToken();
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<AuthResponse>(
      "/auth/login",
      { email, password },
    );
    await saveToken(res.token);
    setUser(res.user);
  }, []);

  const register = useCallback(
    async (email: string, password: string, name?: string, preferences?: MusicPreferences) => {
      const res = await api.post<AuthResponse>(
        "/auth/register",
        { email, password, display_name: name, preferences },
      );
      await saveToken(res.token);
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
