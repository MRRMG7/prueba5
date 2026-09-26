import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../api";
import type { Cliente, Pedido } from "../../types";

interface Props {
  clientes: Cliente[];
  pedidos: Pedido[];
  onCambio: () => Promise<void>;
}

interface Forma {
  id_cliente: number;
  nombre: string;
  telefono: string;
  email: string;
  direccion: string;
}

const VACIA: Forma = { id_cliente: 0, nombre: "", telefono: "", email: "", direccion: "" };

export default function ClientesTab({ clientes, pedidos, onCambio }: Props) {
  const [forma, setForma] = useState<Forma>(VACIA);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  function set<K extends keyof Forma>(k: K, v: string) {
    setForma((f) => ({ ...f, [k]: v }));
  }

  function editar(c: Cliente) {
    setForma({
      id_cliente: c.id_cliente,
      nombre: c.nombre,
      telefono: c.telefono,
      email: c.email,
      direccion: c.direccion,
    });
    setError("");
    setAviso("");
  }

  async function eliminar(c: Cliente) {
    if (!confirm(`¿Eliminar al cliente ${c.nombre}?`)) return;
    try {
      await api(`/clientes/${c.id_cliente}`, { method: "DELETE" });
      await onCambio();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError("");
    setAviso("");
    if (!forma.nombre.trim() || !forma.telefono.trim() || !forma.direccion.trim()) {
      setError("Completá nombre, teléfono y dirección.");
      return;
    }
    const cuerpo = {
      nombre: forma.nombre.trim(),
      telefono: forma.telefono.trim(),
      email: forma.email.trim() || "sin@correo.sv",
      direccion: forma.direccion.trim(),
    };
    try {
      await api(forma.id_cliente ? `/clientes/${forma.id_cliente}` : "/clientes", {
        method: forma.id_cliente ? "PUT" : "POST",
        body: JSON.stringify(cuerpo),
      });
      setForma(VACIA);
      setAviso("Cliente guardado correctamente.");
      await onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el cliente.");
    }
  }

  return (
    <div>
      <section className="tarjeta">
        <div className="cabecera-tarjeta">
          <h2>{forma.id_cliente ? `Editar ${forma.nombre}` : "Nuevo cliente"}</h2>
          <p>Registrá, editá o eliminá los clientes que reciben los envíos.</p>
        </div>
        <div className="cuerpo-tarjeta">
          <form onSubmit={enviar}>
            <div className="form-grid-4">
              <label className="campo">
                <span>Nombre completo</span>
                <input
                  value={forma.nombre}
                  onChange={(e) => set("nombre", e.target.value)}
                  placeholder="Nombre y apellido"
                />
              </label>
              <label className="campo">
                <span>Teléfono</span>
                <input
                  value={forma.telefono}
                  onChange={(e) => set("telefono", e.target.value)}
                  placeholder="7000-0000"
                />
              </label>
              <label className="campo">
                <span>Correo</span>
                <input
                  value={forma.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="correo@ejemplo.com"
                />
              </label>
              <label className="campo">
                <span>Dirección</span>
                <input
                  value={forma.direccion}
                  onChange={(e) => set("direccion", e.target.value)}
                  placeholder="Dirección fiscal o de entrega"
                />
              </label>
            </div>
            <div className="fila-acciones">
              <button type="submit" className="btn btn-verde">
                {forma.id_cliente ? "Actualizar" : "Guardar"}
              </button>
              {forma.id_cliente && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setForma(VACIA);
                    setError("");
                    setAviso("");
                  }}
                >
                  Limpiar
                </button>
              )}
            </div>
          </form>
          {error && <p className="error-login">{error}</p>}
          {aviso && <p className="aviso-banner verde">{aviso}</p>}
        </div>
      </section>

      <section className="tarjeta">
        <div className="cabecera-tarjeta">
          <h2>Clientes</h2>
          <p>Todos los clientes registrados y sus envíos.</p>
        </div>
        <div className="cuerpo-tarjeta">
          <div className="overflow">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Teléfono</th>
                  <th>Correo</th>
                  <th>Dirección</th>
                  <th>Envíos</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clientes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="celda-suave" style={{ textAlign: "center", padding: "28px 12px" }}>
                      No hay clientes registrados.
                    </td>
                  </tr>
                )}
                {clientes.map((c) => {
                  const envios = pedidos.filter((p) => p.id_cliente === c.id_cliente);
                  return (
                    <tr key={c.id_cliente}>
                      <td className="celda-fuerte">{c.nombre}</td>
                      <td className="celda-suave">{c.telefono}</td>
                      <td className="celda-suave">{c.email || "—"}</td>
                      <td className="celda-suave">{c.direccion}</td>
                      <td>
                        <span className="pill" style={{ background: "rgba(46,196,182,.12)", color: "#0b8378" }}>
                          {envios.length}
                        </span>
                      </td>
                      <td>
                        <div className="fila-acciones">
                          <button onClick={() => editar(c)} className="btn">
                            ✎ Editar
                          </button>
                          <button onClick={() => eliminar(c)} className="btn btn-rojo">
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}