import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api";

export default function CambiarPasswordModal({
  onCerrar,
}: {
  onCerrar: () => void;
}) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState("");
  const [exito, setExito] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!actual || !nueva) {
      setError("Completá la contraseña actual y la nueva.");
      return;
    }
    if (nueva !== confirmacion) {
      setError("La nueva contraseña y su confirmación no coinciden.");
      return;
    }
    setCargando(true);
    try {
      await api("/cambiar-password", {
        method: "POST",
        body: JSON.stringify({ password_actual: actual, password_nueva: nueva }),
      });
      setExito(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal-caja" onClick={(e) => e.stopPropagation()}>
        <div className="modal-cabecera">
          <div>
            <h3 className="modal-titulo">Cambiar contraseña</h3>
            <p className="modal-sub">Actualizá la clave con la que entrás al sistema.</p>
          </div>
          <button type="button" className="modal-cerrar" onClick={onCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>

        {exito ? (
          <>
            <p className="ok-login">Contraseña actualizada correctamente.</p>
            <div className="modal-pie">
              <button type="button" className="btn btn-verde" onClick={onCerrar}>
                Listo
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={enviar}>
            <label className="campo">
              <span>Contraseña actual</span>
              <input
                type="password"
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            <label className="campo">
              <span>Nueva contraseña</span>
              <input
                type="password"
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
                placeholder="Mínimo 4 caracteres"
                autoComplete="new-password"
              />
            </label>
            <label className="campo">
              <span>Confirmar nueva contraseña</span>
              <input
                type="password"
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                autoComplete="new-password"
              />
            </label>

            {error && <p className="aviso-banner rojo">{error}</p>}

            <div className="modal-pie">
              <button type="button" className="btn" onClick={onCerrar} disabled={cargando}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-verde" disabled={cargando}>
                {cargando ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}