import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

const CLAVE = "transporte:tema:v1";
type Tema = "dia" | "noche";

interface TemaCtx {
  tema: Tema;
  alternar: () => void;
}

const Contexto = createContext<TemaCtx>({ tema: "dia", alternar: () => {} });

function leerTema(): Tema {
  if (typeof window === "undefined") return "dia";
  const guardado = window.localStorage.getItem(CLAVE);
  if (guardado === "noche" || guardado === "dia") return guardado;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "noche" : "dia";
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(leerTema);
  useEffect(() => {
    document.documentElement.setAttribute("data-tema", tema);
    window.localStorage.setItem(CLAVE, tema);
  }, [tema]);
  const alternar = useCallback(() => {
    setTema((t) => (t === "dia" ? "noche" : "dia"));
  }, []);
  return <Contexto.Provider value={{ tema, alternar }}>{children}</Contexto.Provider>;
}

export function useTema() {
  return useContext(Contexto);
}

export function BotonTema() {
  const { tema, alternar } = useTema();
  const noche = tema === "noche";
  return (
    <button
      type="button"
      className="boton-tema"
      onClick={alternar}
      aria-label={noche ? "Cambiar a modo día" : "Cambiar a modo noche"}
      title={noche ? "Modo noche · tocar para día" : "Modo día · tocar para noche"}
    >
      {noche ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}