import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../auth";

export default function Login({ onVolver }: { onVolver?: () => void }) {
  const { login } = useAuth();
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!usuario || !password) {
      setError("Ingresá tu usuario y contraseña.");
      return;
    }
    setCargando(true);
    try {
      await login(usuario, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="pantalla">
      <section className="panel-marca">
        <div className="marca">
          <span className="marca-icono" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="22" height="22">
              <path d="M4 20 C 9 8, 18 22, 28 6" fill="none" stroke="#2ec4b6" strokeWidth="2.6" strokeLinecap="round" />
              <circle cx="4" cy="20" r="3" fill="#f5a623" />
              <circle cx="28" cy="6" r="3" fill="#f5a623" />
            </svg>
          </span>
          <span className="marca-texto">Transporte &amp; Entregas</span>
        </div>
        <h1 className="titular">
          Cada pedido,
          <br />
          visible en su ruta.
        </h1>
        <p className="subtitular">
          Administradores, conductores y clientes comparten un solo lugar para saber dónde va cada
          entrega y en qué estado está.
        </p>

        <div className="ruta-animada" aria-hidden="true">
          <svg viewBox="0 0 640 300" fill="none">
            <path
              className="linea-base"
              d="M 60 180 C 150 70, 250 190, 330 120 C 400 60, 500 170, 590 60"
            />
            <path
              className="linea-flujo"
              d="M 60 180 C 150 70, 250 190, 330 120 C 400 60, 500 170, 590 60"
            />
            <circle className="nodo-fuera" cx="60" cy="180" r="15" fill="rgba(245,166,35,.18)" />
            <circle className="nodo" cx="60" cy="180" r="10" fill="#f5a623" />
            <circle className="nodo-fuera" cx="330" cy="120" r="15" fill="rgba(245,166,35,.18)" />
            <circle className="nodo" cx="330" cy="120" r="10" fill="#f5a623" />
            <circle cx="590" cy="60" r="14" fill="rgba(46,196,182,.16)" />
            <circle className="nodo" cx="590" cy="60" r="10" fill="#2ec4b6" />
          </svg>
          <span className="etiqueta-ruta camino">En camino</span>
          <span className="etiqueta-ruta entregado">Entregado</span>
        </div>

        <p className="pie-marca">
          Sistema de Gestión de Transporte y Entregas · El Salvador
        </p>
      </section>

      <section className="panel-formulario">
        <div className="tarjeta-login">
          <h2 className="form-titulo">Inicia sesión</h2>
          <p className="form-subtitulo">Ingresá tus datos para ver tus entregas.</p>

          {error && <p className="error-login" style={{ marginTop: 14 }}>{error}</p>}

          <form onSubmit={enviar} className="form-login">
            <label className="campo">
              <span>Usuario</span>
              <input
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="admin"
                autoComplete="off"
              />
            </label>
            <label className="campo">
              <span>Contraseña</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </label>
            <button type="submit" className="btn-entrar" disabled={cargando}>
              {cargando ? "Entrando…" : "Entrar"}
            </button>
          </form>

          {onVolver && (
            <button type="button" className="link-suave" onClick={onVolver}>
              ← Volver al inicio
            </button>
          )}
        </div>
      </section>
    </main>
  );
}