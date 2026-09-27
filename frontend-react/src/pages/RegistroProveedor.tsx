import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api";

export default function RegistroProveedor({ onVolver }: { onVolver?: () => void }) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [direccion, setDireccion] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError("");
    setExito("");
    if (!nombre.trim() || !telefono.trim() || !email.trim() || !username.trim() || !password) {
      setError("Completá nombre, teléfono, correo, usuario y contraseña.");
      return;
    }
    setCargando(true);
    try {
      await api("/registro-proveedor", {
        method: "POST",
        body: JSON.stringify({
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          email: email.trim(),
          direccion: direccion.trim() || null,
          username: username.trim(),
          password,
        }),
      });
      setExito(`Comercio registrado. Ya podés iniciar sesión con tu usuario "${username.trim()}".`);
      setNombre("");
      setTelefono("");
      setEmail("");
      setDireccion("");
      setUsername("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta.");
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
          ¿Tenés un negocio,
          <br />
          tienda o comercio?
        </h1>
        <p className="subtitular">
          Registrá tu comercio y sos proveedor de entregas: creá pedidos para tus clientes y seguí
          cada envío con su evidencia de entrega.
        </p>

        <div className="ruta-animada" aria-hidden="true">
          <svg viewBox="0 0 640 300" fill="none">
            <path className="linea-base" d="M 60 180 C 150 70, 250 190, 330 120 C 400 60, 500 170, 590 60" />
            <path className="linea-flujo" d="M 60 180 C 150 70, 250 190, 330 120 C 400 60, 500 170, 590 60" />
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
          <h2 className="form-titulo">Crear cuenta de proveedor</h2>
          <p className="form-subtitulo">
            El administrador coordinará el reparto de tus pedidos.
          </p>

          {error && <p className="error-login" style={{ marginTop: 14 }}>{error}</p>}
          {exito && (
            <p className="ok-login" style={{ marginTop: 14 }}>
              {exito}
            </p>
          )}

          <form onSubmit={enviar} className="form-login">
            <label className="campo">
              <span>Nombre del comercio</span>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Farmacia San José"
              />
            </label>
            <label className="campo">
              <span>Teléfono</span>
              <input
                type="text"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="7XXX-XXXX"
              />
            </label>
            <label className="campo">
              <span>Correo</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="comercio@correo.com"
              />
            </label>
            <label className="campo">
              <span>Dirección (opcional)</span>
              <input
                type="text"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Ubicación del comercio"
              />
            </label>
            <label className="campo">
              <span>Usuario</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="usuario"
                autoComplete="off"
              />
            </label>
            <label className="campo">
              <span>Contraseña</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 4 caracteres"
                autoComplete="new-password"
              />
            </label>
            <button type="submit" className="btn-entrar" disabled={cargando}>
              {cargando ? "Creando cuenta…" : "Registrar comercio"}
            </button>
          </form>

          {onVolver && (
            <button type="button" className="link-suave" onClick={onVolver}>
              ← Ya tengo cuenta · Iniciar sesión
            </button>
          )}
        </div>
      </section>
    </main>
  );
}