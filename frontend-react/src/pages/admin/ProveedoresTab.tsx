import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../api";
import type { Proveedor } from "../../types";

interface Props {
  proveedores: Proveedor[];
  onCambio: () => Promise<void>;
}

interface Forma {
  id_proveedor: number;
  nombre: string;
  telefono: string;
  email: string;
  direccion: string;
}

const VACIA: Forma = { id_proveedor: 0, nombre: "", telefono: "", email: "", direccion: "" };

export default function ProveedoresTab({ proveedores, onCambio }: Props) {
  const [forma, setForma] = useState<Forma>(VACIA);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  function set<K extends keyof Forma>(k: K, v: string) {
    setForma((f) => ({ ...f, [k]: v }));
  }

  function editar(p: Proveedor) {
    setForma({
      id_proveedor: p.id_proveedor,
      nombre: p.nombre,
      telefono: p.telefono,
      email: p.email,
      direccion: p.direccion ?? "",
    });
    setError("");
    setAviso("");
  }

  async function eliminar(p: Proveedor) {
    if (!confirm(`¿Eliminar el negocio ${p.nombre}? Se elimina también su cuenta.`)) return;
    try {
      await api(`/proveedores/${p.id_proveedor}`, { method: "DELETE" });
      await onCambio();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError("");
    setAviso("");
    const nombre = forma.nombre.trim();
    const telefono = forma.telefono.trim();
    const email = forma.email.trim();
    if (!nombre || !telefono || !email) {
      setError("Completá nombre, teléfono y correo.");
      return;
    }
    const cuerpo = {
      nombre,
      telefono,
      email,
      direccion: forma.direccion.trim(),
    };
    const editando = forma.id_proveedor !== 0;
    try {
      const res = await api<{ username: string; password_inicial: string }>(
        editando ? `/proveedores/${forma.id_proveedor}` : "/proveedores",
        {
          method: editando ? "PUT" : "POST",
          body: JSON.stringify(cuerpo),
        },
      );
      setForma(VACIA);
      await onCambio();
      if (!editando && res.username) {
        setAviso(
          `Negocio creado. Usuario: ${res.username} · Contraseña: ${res.password_inicial}`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el negocio.");
    }
  }

  return (
    <div>
      <section className="tarjeta">
        <div className="cabecera-tarjeta">
          <h2>{forma.id_proveedor ? `Editar ${forma.nombre}` : "Nuevo negocio"}</h2>
          <p>Alta de negocios transportistas. La cuenta se crea con este usuario y contraseña.</p>
        </div>
        <div className="cuerpo-tarjeta">
          <form onSubmit={enviar}>
            <div className="form-grid-4">
              <label className="campo">
                <span>Nombre del negocio</span>
                <input
                  value={forma.nombre}
                  onChange={(e) => set("nombre", e.target.value)}
                  placeholder="Transportes El Salvador"
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
                  placeholder="Dirección del negocio"
                />
              </label>
            </div>
            <div className="fila-acciones">
              <button type="submit" className="btn btn-verde">
                {forma.id_proveedor ? "Actualizar" : "Guardar"}
              </button>
              {forma.id_proveedor && (
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
          <h2>Negocios</h2>
          <p>Todos los negocios registrados.</p>
        </div>
        <div className="cuerpo-tarjeta">
          <div className="overflow">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Negocio</th>
                  <th>Teléfono</th>
                  <th>Correo</th>
                  <th>Dirección</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {proveedores.length === 0 && (
                  <tr>
                    <td colSpan={5} className="celda-suave" style={{ textAlign: "center", padding: "28px 12px" }}>
                      No hay negocios registrados.
                    </td>
                  </tr>
                )}
                {proveedores.map((p) => (
                  <tr key={p.id_proveedor}>
                    <td className="celda-fuerte">{p.nombre}</td>
                    <td className="celda-suave">{p.telefono}</td>
                    <td className="celda-suave">{p.email || "—"}</td>
                    <td className="celda-suave">{p.direccion || "—"}</td>
                    <td>
                      <div className="fila-acciones">
                        <button onClick={() => editar(p)} className="btn">
                          ✎ Editar
                        </button>
                        <button onClick={() => eliminar(p)} className="btn btn-rojo">
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}