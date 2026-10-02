import { useEffect, useState } from "react";
import { api, nombreCliente, nombreProveedor, urlArchivo } from "../../api";
import type { Cliente, Conductor, Pedido, Proveedor, Vehiculo } from "../../types";
import EstadoPill from "../../components/EstadoPill";
import EvidenciaModal from "../../components/EvidenciaModal";
import FormPedido from "./FormPedido";

interface Props {
  pedidos: Pedido[];
  clientes: Cliente[];
  conductores: Conductor[];
  proveedores?: Proveedor[];
  onCambio: () => Promise<void>;
}

export default function PedidosTab({ pedidos, clientes, conductores, proveedores = [], onCambio }: Props) {
  const [editando, setEditando] = useState<Pedido | null>(null);
  const [evidencia, setEvidencia] = useState<string | null>(null);
  const [aprobarEn, setAprobarEn] = useState<Pedido | null>(null);
  const [conductorAprobar, setConductorAprobar] = useState(0);
  const [vehiculoAprobar, setVehiculoAprobar] = useState(0);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [vista, setVista] = useState<"paquetes" | "recolectados">("paquetes");

  const porFecha = (a: Pedido, b: Pedido) => b.id_pedido - a.id_pedido;
  const recolectados = pedidos.filter((p) => p.estado === "RECOLECTADO").sort(porFecha);
  const normales = pedidos.filter((p) => p.estado !== "RECOLECTADO").sort(porFecha);
  const lista = vista === "recolectados" ? recolectados : normales;

  useEffect(() => {
    api<Vehiculo[]>("/vehiculos").then(setVehiculos).catch(() => {});
  }, []);

  function abrirAprobar(p: Pedido) {
    setAprobarEn(p);
    setConductorAprobar(p.id_conductor ?? 0);
    setVehiculoAprobar(p.id_vehiculo ?? 0);
    setError("");
  }

  async function confirmarAprobar() {
    if (!aprobarEn) return;
    if (!conductorAprobar) {
      setError("Seleccioná un conductor.");
      return;
    }
    setGuardando(true);
    setError("");
    try {
      await api(`/pedidos/${aprobarEn.id_pedido}/aprobar`, {
        method: "POST",
        body: JSON.stringify({
          id_conductor: conductorAprobar,
          id_vehiculo: vehiculoAprobar || null,
        }),
      });
      setAprobarEn(null);
      await onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo aprobar el pedido.");
    } finally {
      setGuardando(false);
    }
  }

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
        <div className="pestanas">
          <button
            type="button"
            className={"pestana" + (vista === "paquetes" ? " activa" : "")}
            onClick={() => setVista("paquetes")}
          >
            Paquetes
            <span className="pestana-conteo">{normales.length}</span>
          </button>
          <button
            type="button"
            className={"pestana" + (vista === "recolectados" ? " activa" : "")}
            onClick={() => setVista("recolectados")}
          >
            Recolectados
            <span className="pestana-conteo">{recolectados.length}</span>
          </button>
        </div>

        <div className="overflow">
          <table className="tabla">
            <thead>
              <tr>
              <th>Nº seguimiento</th>
              <th>Comercio</th>
              <th>Cliente</th>
              <th>Dirección</th>
              <th>Estado</th>
              <th>Código</th>
              <th>Asignado a</th>
              <th>Evidencia</th>
              <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 && (
                <tr>
                  <td colSpan={9} className="celda-suave" style={{ textAlign: "center", padding: "28px 12px" }}>
                    {vista === "recolectados"
                      ? "No hay paquetes recolectados."
                      : "No hay paquetes."}
                  </td>
                </tr>
              )}
              {lista.map((p) => (
                <tr key={p.id_pedido}>
                  <td>
                    <span className="codigo-tracking">#{p.id_pedido}</span>
                  </td>
                  <td className="celda-suave">{nombreProveedor(p, proveedores)}</td>
                  <td>{nombreCliente(p, clientes)}</td>
                  <td className="celda-suave">{p.direccion}</td>
                  <td>
                    <EstadoPill estado={p.estado} />
                  </td>
                  <td>
                    {p.codigo_recolecta ? (
                      <span className="codigo-tracking">{p.codigo_recolecta}</span>
                    ) : (
                      <span className="celda-suave">—</span>
                    )}
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
                    {p.foto_entrega ? (
                      <button className="btn" onClick={() => setEvidencia(urlArchivo(p.foto_entrega))}>
                        📷 Ver
                      </button>
                    ) : (
                      <span className="celda-suave">—</span>
                    )}
                  </td>
                  <td>
                    <div className="fila-acciones">
                      {p.estado === "PENDIENTE" && (
                        <button onClick={() => abrirAprobar(p)} className="btn btn-verde">
                          ✓ Aprobar
                        </button>
                      )}
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

      {evidencia && (
        <EvidenciaModal
          url={evidencia}
          titulo="Evidencia de entrega"
          onCerrar={() => setEvidencia(null)}
        />
      )}

      {aprobarEn && (
        <div className="modal-fondo" onClick={() => setAprobarEn(null)}>
          <div className="modal-caja" onClick={(e) => e.stopPropagation()}>
            <div className="modal-cabecera">
              <div>
                <h3 className="modal-titulo">Aprobar pedido #{aprobarEn.id_pedido}</h3>
                <p className="modal-sub">
                  Se genera el código de recolecta que ingressa el conductor al recoger el paquete.
                </p>
              </div>
              <button type="button" className="modal-cerrar" onClick={() => setAprobarEn(null)}>
                ✕
              </button>
            </div>
            <div className="cuerpo-tarjeta">
              <div className="form-grid-2">
                <label className="campo">
                  <span>Conductor</span>
                  <select
                    className="select-mini"
                    value={conductorAprobar}
                    onChange={(e) => setConductorAprobar(Number(e.target.value))}
                  >
                    <option value={0}>— Seleccionar —</option>
                    {conductores.map((c) => (
                      <option key={c.id_conductor} value={c.id_conductor}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="campo">
                  <span>Vehículo</span>
                  <select
                    className="select-mini"
                    value={vehiculoAprobar}
                    onChange={(e) => setVehiculoAprobar(Number(e.target.value))}
                  >
                    <option value={0}>— Sin vehículo —</option>
                    {vehiculos.map((v) => (
                      <option key={v.id_vehiculo} value={v.id_vehiculo}>
                        {v.tipo} ({v.placa})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {error && <p className="error-login">{error}</p>}
              <div className="fila-acciones" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-verde"
                  onClick={confirmarAprobar}
                  disabled={guardando}
                >
                  {guardando ? "Aprobando…" : "Aprobar y asignar"}
                </button>
                <button type="button" className="btn" onClick={() => setAprobarEn(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}