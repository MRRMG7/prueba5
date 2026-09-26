import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../api";
import type { Conductor } from "../../types";

interface Props {
  conductores: Conductor[];
  onCambio: () => Promise<void>;
}

interface Forma {
  id_conductor: number;
  nombre: string;
  email: string;
  licencia: string;
  telefono: string;
}

const VACIA: Forma = { id_conductor: 0, nombre: "", email: "", licencia: "", telefono: "" };

export default function ConductoresTab({ conductores, onCambio }: Props) {
  const [forma, setForma] = useState<Forma>(VACIA);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  function set<K extends keyof Forma>(k: K, v: string) {
    setForma((f) => ({ ...f, [k]: v }));
  }

  function editar(c: Conductor) {
    setForma({
      id_conductor: c.id_conductor,
      nombre: c.nombre,
      email: c.email ?? "",
      licencia: c.licencia,
      telefono: c.telefono,
    });
    setError("");
    setAviso("");
  }

  async function eliminar(c: Conductor) {
    if (!confirm(`¿Eliminar a ${c.nombre}?`)) return;
    try {
      await api(`/conductores/${c.id_conductor}`, { method: "DELETE" });
      await onCambio();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError("");
    setAviso("");
    if (!forma.nombre.trim() || !forma.licencia.trim() || !forma.telefono.trim()) {
      setError("Completá nombre, licencia y teléfono.");
      return;
    }
    const cuerpo = {
      nombre: forma.nombre.trim(),
      licencia: forma.licencia.trim(),
      telefono: forma.telefono.trim(),
      email: forma.email.trim() || null,
    };
    try {
      const res = await api<{ username: string }>(
        forma.id_conductor ? `/conductores/${forma.id_conductor}` : "/conductores",
        {
          method: forma.id_conductor ? "PUT" : "POST",
          body: JSON.stringify(forma.id_conductor ? { ...cuerpo, email: cuerpo.email } : cuerpo),
        },
      );
      setForma(VACIA);
      await onCambio();
      if (!forma.id_conductor && res.username) {
        setAviso(`Conductor creado. Usuario: ${res.username} · Contraseña: 123`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el conductor.");
    }
  }

  return (
    <div>
      <section className="tarjeta">
        <div className="cabecera-tarjeta">
          <h2>{forma.id_conductor ? `Editar ${forma.nombre}` : "Nuevo conductor"}</h2>
          <p>Registrá, editá o eliminá conductores del equipo.</p>
        </div>
        <div className="cuerpo-tarjeta">
          <form onSubmit={enviar}>
            <div className="form-grid-4">
              <label className="campo">
                <span>Nombre completo</span>
                <input value={forma.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Nombre y apellido" />
              </label>
              <label className="campo">
                <span>Correo</span>
                <input value={forma.email} onChange={(e) => set("email", e.target.value)} placeholder="correo@ejemplo.com" />
              </label>
              <label className="campo">
                <span>Licencia</span>
                <input value={forma.licencia} onChange={(e) => set("licencia", e.target.value)} placeholder="Nº de licencia" />
              </label>
              <label className="campo">
                <span>Teléfono</span>
                <input value={forma.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="7000-0000" />
              </label>
            </div>
            <div className="fila-acciones">
              <button type="submit" className="btn btn-verde">
                {forma.id_conductor ? "Actualizar" : "Guardar"}
              </button>
              {forma.id_conductor && (
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
          <h2>Conductores</h2>
          <p>Todos los conductores del equipo de entregas.</p>
        </div>
        <div className="cuerpo-tarjeta">
          <div className="overflow">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Conductor</th>
                  <th>Correo</th>
                  <th>Teléfono</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {conductores.length === 0 && (
                  <tr>
                    <td colSpan={4} className="celda-suave" style={{ textAlign: "center", padding: "28px 12px" }}>
                      No hay conductores registrados.
                    </td>
                  </tr>
                )}
                {conductores.map((c) => (
                  <tr key={c.id_conductor}>
                    <td className="celda-fuerte">{c.nombre}</td>
                    <td className="celda-suave">{c.email || "—"}</td>
                    <td className="celda-suave">{c.telefono}</td>
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}