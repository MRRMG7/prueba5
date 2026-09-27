import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Sesion } from "./types";
import { CLAVE_SESION, api } from "./api";

interface AuthCtx {
  sesion: Sesion | null;
  login: (usuario: string, password: string) => Promise<Sesion>;
  logout: () => void;
  setFoto: (foto: string | null) => void;
}

const Ctx = createContext<AuthCtx>({
  sesion: null,
  login: async () => {
    throw new Error("Auth no listo");
  },
  logout: () => {},
  setFoto: () => {},
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

  const setFoto = useCallback((foto: string | null) => {
    setSesion((prev) => {
      if (!prev) return prev;
      const nueva = { ...prev, foto };
      try {
        localStorage.setItem(CLAVE_SESION, JSON.stringify(nueva));
      } catch {
        /* localStorage no disponible */
      }
      return nueva;
    });
  }, []);

  const valor = useMemo(
    () => ({ sesion, login, logout, setFoto }),
    [sesion, login, logout, setFoto],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}