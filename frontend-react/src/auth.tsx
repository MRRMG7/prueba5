import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Sesion } from "./types";
import { api } from "./api";

const CLAVE_SESION = "transporte:sesion:v1";

interface AuthCtx {
  sesion: Sesion | null;
  login: (usuario: string, password: string) => Promise<Sesion>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({
  sesion: null,
  login: async () => {
    throw new Error("Auth no listo");
  },
  logout: () => {},
});

function leerStored(): Sesion | null {
  try {
    const raw = localStorage.getItem(CLAVE_SESION);
    return raw ? (JSON.parse(raw) as Sesion) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(leerStored);

  const login = useCallback(async (usuario: string, password: string) => {
    const data = await api<Sesion>("/login", {
      method: "POST",
      body: JSON.stringify({ username: usuario, password }),
    });
    localStorage.setItem(CLAVE_SESION, JSON.stringify(data));
    setSesion(data);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(CLAVE_SESION);
    setSesion(null);
  }, []);

  const valor = useMemo(() => ({ sesion, login, logout }), [sesion, login, logout]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}