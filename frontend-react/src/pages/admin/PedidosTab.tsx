import { useState } from "react";
import { api, nombreCliente } from "../../api";
import type { Cliente, Conductor, Pedido } from "../../types";
import EstadoPill from "../../components/EstadoPill";
import FormPedido from "./FormPedido";

interface Props {
  pedidos: Pedido[];
  clientes: Cliente[];
  conductores: Conductor[];
  onCambio: () => Promise<void>;
}

export default function PedidosTab({ pedidos, clientes, conductores, onCambio }: Props) {
  const [editando, setEditando] = useState<Pedido | null>(null);
  const lista = [...pedidos].sort((a, b) => b.id_pedido - a.id_pedido);

  async function reasignar(p: Pedido) {
    const opciones = conductores.map((c, i) => `${i + 1}) ${c.nombre}`).join("\n");
    if (!opciones) {
      alert("No hay conductores registrados.");
      return;
    }
    const objetivo = prompt(`Reasignar #${p.id_pedido} a otro conductor:\n${opciones}`, "1");
    if (objetivo === null) return;
    const c = conductores[Number(objetivo.trim()) - 1];
    if (!c) {
      alert("Conductor inválido.");
      return;
    }
    try {
      await asignar(p, c.id_conductor);
      await onCambio();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error");
    }
  }

  async function asignar(p: Pedido, idConductor: number | null) {
    await api(`/pedidos/${p.id_pedido}`, {
      method: "PUT",
      body: JSON.stringify({
        id_cliente: p.id_cliente,
        direccion: p.direccion,
        latitud: p.latitud,
        longitud: p.longitud,
        id_conductor: idConductor,
        id_vehiculo: p.id_vehiculo,
        estado: idConductor ? "ASIGNADO" : "PENDIENTE",
      }),
    });
  }

  async function retirar(p: Pedido) {
    if (!confirm(`¿Retirar #${p.id_pedido}? Queda sin asignar.`)) return;
    try {
      await asignar(p, null);
      await onCambio();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error");
    }
  }

  async function cambiarAsignacion(p: Pedido, valor: string) {
    try {
      await asignar(p, valor ? Number(valor) : null);
      await onCambio();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <section className="tarjeta">
      <div className="cabecera-tarjeta">
        <h2>Paquetes</h2>
        <p>Asigná paquetes a conductores. El conductor actualiza el estado desde su panel.</p>
      </div>
      <div className="cuerpo-tarjeta">
        <div className="overflow">
          <table className="tabla">
            <thead>
              <tr>
                <th>Nº seguimiento</th>
                <th>Cliente</th>
                <th>Dirección</th>
                <th>Estado</th>
                <th>Asignado a</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 && (
                <tr>
                  <td colSpan={6} className="celda-suave" style={{ textAlign: "center", padding: "28px 12px" }}>
                    No hay pedidos.
                  </td>
                </tr>
              )}
              {lista.map((p) => (
                <tr key={p.id_pedido}>
                  <td>
                    <span className="codigo-tracking">#{p.id_pedido}</span>
                  </td>
                  <td>{nombreCliente(p, clientes)}</td>
                  <td className="celda-suave">{p.direccion}</td>
                  <td>
                    <EstadoPill estado={p.estado} />
                  </td>
                  <td>
                    <select
                      value={p.id_conductor ?? ""}
                      onChange={(e) => cambiarAsignacion(p, e.target.value)}
                      className="select-mini"
                    >
                      <option value="">— sin asignar —</option>
                      {conductores.map((c) => (
                        <option key={c.id_conductor} value={c.id_conductor}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="fila-acciones">
                      <button onClick={() => setEditando(p)} className="btn">
                        ✎ Editar
                      </button>
                      {(p.estado === "ENTREGADO" || p.estado === "INCIDENCIA") && p.id_conductor && (
                        <button onClick={() => reasignar(p)} className="btn btn-verde">
                          Reasignar
                        </button>
                      )}
                      {p.id_conductor && (
                        <button onClick={() => retirar(p)} className="btn btn-rojo">
                          Retirar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editando && (
        <FormPedido pedido={editando} onCerrar={() => setEditando(null)} onGuardado={onCambio} />
      )}
    </section>
  );
}