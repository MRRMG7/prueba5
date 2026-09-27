import { useEffect, useRef, useState } from "react";

const COLORES_AVATAR = ["#0b8378", "#f5a623", "#3b82f6", "#8b5cf6", "#e53e3e", "#0ea5e9"];

function iniciales(nombre: string): string {
  return (
    nombre
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || "")
      .join("") || "?"
  );
}

interface Props {
  nombre?: string;
  usuario?: string;
  rol?: string;
  onCambiarPassword?: () => void;
  onCerrarSesion?: () => void;
}

export default function MenuUsuario({
  nombre,
  usuario,
  rol,
  onCambiarPassword,
  onCerrarSesion,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    function afuera(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false);
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("mousedown", afuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", afuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  const nombreMostrado = nombre?.trim() || "Usuario";
  const color = COLORES_AVATAR[(nombreMostrado.charCodeAt(0) || 0) % COLORES_AVATAR.length];

  return (
    <div className="menu-usuario" ref={raiz}>
      <button
        type="button"
        className="avatar"
        style={{ background: color }}
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label="Menú de cuenta"
        title={nombreMostrado}
      >
        {iniciales(nombreMostrado)}
      </button>

      {abierto && (
        <div className="menu-desplegable" role="menu">
          <div className="menu-cabecera">
            <span className="menu-avatar" style={{ background: color }}>
              {iniciales(nombreMostrado)}
            </span>
            <div className="menu-datos">
              <p className="menu-nombre">{nombreMostrado}</p>
              <p className="menu-usuario-linea">
                {rol || "Cuenta"} {usuario ? `· @${usuario}` : ""}
              </p>
            </div>
          </div>
          <div className="menu-separador" />
          {onCambiarPassword && (
            <button
              type="button"
              className="menu-item"
              role="menuitem"
              onClick={() => {
                setAbierto(false);
                onCambiarPassword();
              }}
            >
              Cambiar contraseña
            </button>
          )}
          {onCerrarSesion && (
            <button
              type="button"
              className="menu-item danger"
              role="menuitem"
              onClick={() => {
                setAbierto(false);
                onCerrarSesion();
              }}
            >
              Cerrar sesión
            </button>
          )}
        </div>
      )}
    </div>
  );
}