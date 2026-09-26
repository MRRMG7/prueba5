import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../api";
import type { Vehiculo } from "../../types";

interface Props {
  vehiculos: Vehiculo[];
  onCambio: () => Promise<void>;
}

interface Forma {
  id_vehiculo: number;
  placa: string;
  tipo: string;
  capacidad: string;
}

const VACIA: Forma = { id_vehiculo: 0, placa: "", tipo: "", capacidad: "" };

export default function VehiculosTab({ vehiculos, onCambio }: Props) {
  const [forma, setForma] = useState<Forma>(VACIA);
  const [error, setError] = useState("");

  function set<K extends keyof Forma>(k: K, v: string) {
    setForma((f) => ({ ...f, [k]: v }));
  }

  function editar(v: Vehiculo) {
    setForma({
      id_vehiculo: v.id_vehiculo,
      placa: v.placa,
      tipo: v.tipo,
      capacidad: v.capacidad,
    });
    setError("");
  }

  async function eliminar(v: Vehiculo) {
    if (!confirm(`¿Eliminar el vehículo ${v.placa}?`)) return;
    try {
      await api(`/vehiculos/${v.id_vehiculo}`, { method: "DELETE" });
      await onCambio();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!forma.placa.trim() || !forma.tipo.trim() || !forma.capacidad.trim()) {
      setError("Completá placa, tipo y capacidad.");
      return;
    }
    const cuerpo = {
      placa: forma.placa.trim(),
      tipo: forma.tipo.trim(),
      capacidad: forma.capacidad.trim(),
    };
    try {
      await api(forma.id_vehiculo ? `/vehiculos/${forma.id_vehiculo}` : "/vehiculos", {
        method: forma.id_vehiculo ? "PUT" : "POST",
        body: JSON.stringify(cuerpo),
      });
      setForma(VACIA);
      await onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el vehículo.");
    }
  }

  return (
    <div>
      <section className="tarjeta">
        <div className="cabecera-tarjeta">
          <h2>{forma.id_vehiculo ? `Editar ${forma.placa}` : "Nuevo vehículo"}</h2>
          <p>Registrá, editá o eliminá vehículos de la flota.</p>
        </div>
        <div className="cuerpo-tarjeta">
          <form onSubmit={enviar}>
            <div className="form-grid-3">
              <label className="campo">
                <span>Placa</span>
                <input value={forma.placa} onChange={(e) => set("placa", e.target.value)} placeholder="AB-123-456" />
              </label>
              <label className="campo">
                <span>Tipo</span>
                <input value={forma.tipo} onChange={(e) => set("tipo", e.target.value)} placeholder="Camión / Pickup / Moto" />
              </label>
              <label className="campo">
                <span>Capacidad</span>
                <input value={forma.capacidad} onChange={(e) => set("capacidad", e.target.value)} placeholder="500 kg" />
              </label>
            </div>
            <div className="fila-acciones">
              <button type="submit" className="btn btn-verde">
                {forma.id_vehiculo ? "Actualizar" : "Guardar"}
              </button>
              {forma.id_vehiculo && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setForma(VACIA);
                    setError("");
                  }}
                >
                  Limpiar
                </button>
              )}
            </div>
          </form>
          {error && <p className="error-login">{error}</p>}
        </div>
      </section>

      <section className="tarjeta">
        <div className="cabecera-tarjeta">
          <h2>Vehículos</h2>
          <p>Flota disponible para las entregas.</p>
        </div>
        <div className="cuerpo-tarjeta">
          <div className="overflow">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Placa</th>
                  <th>Tipo</th>
                  <th>Capacidad</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {vehiculos.length === 0 && (
                  <tr>
                    <td colSpan={4} className="celda-suave" style={{ textAlign: "center", padding: "28px 12px" }}>
                      No hay vehículos registrados.
                    </td>
                  </tr>
                )}
                {vehiculos.map((v) => (
                  <tr key={v.id_vehiculo}>
                    <td className="celda-fuerte">{v.placa}</td>
                    <td className="celda-suave">{v.tipo || "—"}</td>
                    <td className="celda-suave">{v.capacidad || "—"}</td>
                    <td>
                      <div className="fila-acciones">
                        <button onClick={() => editar(v)} className="btn">
                          ✎ Editar
                        </button>
                        <button onClick={() => eliminar(v)} className="btn btn-rojo">
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