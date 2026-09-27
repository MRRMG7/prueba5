import { useEffect, useRef, useState } from "react";
import { urlArchivo } from "../api";

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

async function archivoAComprimido(archivo: File): Promise<string> {
  const imagen: HTMLImageElement = await new Promise((ok, err) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => err(new Error("No se pudo leer la imagen"));
    img.src = URL.createObjectURL(archivo);
  });
  const MAX = 480;
  const escala = Math.min(1, MAX / Math.max(imagen.width, imagen.height || 1));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.max(1, Math.round(imagen.width * escala));
  lienzo.height = Math.max(1, Math.round(imagen.height * escala));
  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("Navegador sin soporte de canvas");
  ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  return lienzo.toDataURL("image/jpeg", 0.85);
}

interface Props {
  nombre?: string;
  usuario?: string;
  rol?: string;
  foto?: string | null;
  onCambiarFoto?: (dataUrl: string | null) => Promise<void>;
  onCambiarPassword?: () => void;
  onCerrarSesion?: () => void;
}

export default function MenuUsuario({
  nombre,
  usuario,
  rol,
  foto,
  onCambiarFoto,
  onCambiarPassword,
  onCerrarSesion,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [cargandoFoto, setCargandoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState("");
  const raiz = useRef<HTMLDivElement>(null);
  const inputFoto = useRef<HTMLInputElement>(null);

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
  const urlFoto = urlArchivo(foto);

  async function alElegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo || !onCambiarFoto) return;
    setCargandoFoto(true);
    setErrorFoto("");
    try {
      const dataUrl = await archivoAComprimido(archivo);
      await onCambiarFoto(dataUrl);
    } catch (err) {
      setErrorFoto(err instanceof Error ? err.message : "No se pudo actualizar la foto");
    } finally {
      setCargandoFoto(false);
    }
  }

  return (
    <div className="menu-usuario" ref={raiz}>
      <button
        type="button"
        className={"avatar" + (urlFoto ? " avatar-con-foto" : "")}
        style={urlFoto ? undefined : { background: color }}
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label="Menú de cuenta"
        title={nombreMostrado}
      >
        {urlFoto ? <img src={urlFoto} alt={nombreMostrado} /> : iniciales(nombreMostrado)}
      </button>

      {abierto && (
        <div className="menu-desplegable" role="menu">
          <div className="menu-cabecera">
            <span className={"menu-avatar" + (urlFoto ? " avatar-con-foto" : "")} style={urlFoto ? undefined : { background: color }}>
              {urlFoto ? <img src={urlFoto} alt={nombreMostrado} /> : iniciales(nombreMostrado)}
            </span>
            <div className="menu-datos">
              <p className="menu-nombre">{nombreMostrado}</p>
              <p className="menu-usuario-linea">
                {rol || "Cuenta"} {usuario ? `· @${usuario}` : ""}
              </p>
            </div>
          </div>
          <div className="menu-separador" />

          {onCambiarFoto && (
            <>
              <button
                type="button"
                className="menu-item"
                role="menuitem"
                disabled={cargandoFoto}
                onClick={() => inputFoto.current?.click()}
              >
                {cargandoFoto ? "Subiendo…" : foto ? "Cambiar foto" : "Subir foto"}
              </button>
              {foto && (
                <button
                  type="button"
                  className="menu-item"
                  role="menuitem"
                  disabled={cargandoFoto}
                  onClick={() => onCambiarFoto(null)}
                >
                  Quitar foto
                </button>
              )}
              {errorFoto && <p className="ok-login" style={{ margin: "4px 8px" }}>{errorFoto}</p>}
            </>
          )}

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

          <input
            ref={inputFoto}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={alElegirFoto}
          />
        </div>
      )}
    </div>
  );
}