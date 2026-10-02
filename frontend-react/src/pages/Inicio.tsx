import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ESTADO_META, api, nombreCliente, nombreConductor, formatearFecha, urlArchivo } from "../api";
import { ESTILO_MAPA } from "../mapa";
import type { Cliente, Conductor, Pedido, HistorialEntrega } from "../types";
import EvidenciaModal from "../components/EvidenciaModal";

const PASOS: { estado: Pedido["estado"]; etiqueta: string; detalle: string }[] = [
  { estado: "PENDIENTE", etiqueta: "Pedido creado", detalle: "Recibimos tu solicitud." },
  { estado: "ASIGNADO", etiqueta: "Repartidor asignado", detalle: "Ya tiene quién lo lleve." },
  { estado: "RECOLECTADO", etiqueta: "Recolectado", detalle: "El paquete ya fue recogido." },
  { estado: "ENTREGADO", etiqueta: "Entregado", detalle: "Recibido en destino." },
];

const AVANCE: Record<string, number> = {
  PENDIENTE: 1,
  ASIGNADO: 2,
  RECOLECTADO: 3,
  ENTREGADO: 4,
  INCIDENCIA: 2,
  CANCELADO: 1,
};

interface Props {
  onEntrar: () => void;
}

export default function Inicio({ onEntrar }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [historial, setHistorial] = useState<HistorialEntrega[]>([]);
  const [evidencia, setEvidencia] = useState<string | null>(null);
  const [datos, setDatos] = useState<{ clientes: Cliente[]; conductores: Conductor[] }>({
    clientes: [],
    conductores: [],
  });
  const mapaCont = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pedido || !mapaCont.current) return;
    const lng = Number(pedido.longitud);
    const lat = Number(pedido.latitud);
    if (!lng || !lat) return;
    const mapa = new maplibregl.Map({
      container: mapaCont.current,
      style: ESTILO_MAPA,
      center: [lng, lat],
      zoom: 13,
    });
    const popup = new maplibregl.Popup({ offset: 26, closeButton: false }).setHTML(
      `<b>#${pedido.id_pedido}</b><br/>` +
        `<span style="font-size:12px">${ESTADO_META[pedido.estado].etiqueta}<br/>${pedido.direccion}</span>`,
    );
    new maplibregl.Marker({ color: "#e53e3e" })
      .setLngLat([lng, lat])
      .setPopup(popup)
      .addTo(mapa);
    return () => {
      mapa.remove();
    };
  }, [pedido]);

  async function buscar(e: FormEvent) {
    e.preventDefault();
    const texto = busqueda.trim().replace(/^#/, "");
    const id = Number(texto);
    setError("");
    if (!texto || !Number.isFinite(id) || id <= 0) {
      setError("Ingresá un número de seguimiento válido, por ejemplo 1 o #1.");
      return;
    }
    setCargando(true);
    setPedido(null);
    try {
      const [pedidos, clientes, conductores] = await Promise.all([
        api<Pedido[]>("/pedidos"),
        api<Cliente[]>("/clientes"),
        api<Conductor[]>("/conductores"),
      ]);
      const encontrado = (pedidos || []).find((p) => p.id_pedido === id);
      if (!encontrado) {
        setError(`No encontramos ningún pedido con el número ${id}.`);
        return;
      }
      const h = await api<HistorialEntrega[]>(`/pedidos/${id}/historial`);
      setDatos({ clientes: clientes || [], conductores: conductores || [] });
      setHistorial(h || []);
      setPedido(encontrado);
    } catch {
      setError("No se pudo consultar el estado. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  const meta = pedido ? ESTADO_META[pedido.estado] : null;
  const avance = pedido ? AVANCE[pedido.estado] || 1 : 0;

  return (
    <main className="inicio">
      <div className="inicio-cabecera">
        <div className="marca">
          <span className="marca-icono" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="22" height="22">
              <path d="M4 20 C 9 8, 18 22, 28 6" fill="none" stroke="#475569" strokeWidth="2.6" strokeLinecap="round" />
              <circle cx="4" cy="20" r="3" fill="#f5a623" />
              <circle cx="28" cy="6" r="3" fill="#f5a623" />
            </svg>
          </span>
          <span className="marca-texto inicio-marca-texto">Transporte &amp; Entregas</span>
        </div>
        <button type="button" className="inicio-btn-acceso" onClick={onEntrar}>
          Acceso · Iniciar sesión
        </button>
      </div>

      <div className="inicio-buscador">
        <form onSubmit={buscar} className="buscar-form">
          <input
            value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nº de seguimiento (ej. 1 o #1)"
              />
              <button type="submit" className="btn btn-ambar" disabled={cargando}>
                {cargando ? "Buscando…" : "Ver estado"}
              </button>
            </form>

            {error && <p className="aviso-banner rojo" style={{ marginTop: 14 }}>{error}</p>}

            {pedido && meta && (
              <div className="inicio-resultado">
                <button
                  type="button"
                  className="inicio-volver"
                  onClick={() => { setPedido(null); setHistorial([]); setBusqueda(""); setError(""); }}
                >
                  ← Volver al inicio
                </button>
                <div
                  className="inicio-banner"
                  style={{ background: meta.fondo, color: meta.color, border: `1px solid ${meta.color}` }}
                >
                  <span className="celda-fuerte">Pedido #{pedido.id_pedido}</span>
                  <span className="banner-estado">{meta.etiqueta}</span>
                </div>

                <div className="pasos">
                  {PASOS.map((paso, i) => {
                    const hecho = i + 1 <= avance;
                    const activo = pedido.estado === paso.estado;
                    return (
                      <div
                        className={"paso" + (hecho ? " hecho" : "") + (activo ? " activo" : "")}
                        key={paso.estado}
                      >
                        <span className="paso-punto" />
                        <p className="paso-etiqueta" title={paso.detalle}>
                          {paso.etiqueta}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="datos">
                  <div className="dato direccion">
                    <b>Dirección de entrega</b>
                    <span>{pedido.direccion}</span>
                  </div>
                  <div className="dato">
                    <b>Cliente</b>
                    <span>{nombreCliente(pedido, datos.clientes)}</span>
                  </div>
                  <div className="dato">
                    <b>Repartidor</b>
                    <span>{nombreConductor(pedido, datos.conductores)}</span>
                  </div>
                  <div className="dato">
                    <b>Vehículo</b>
                    <span>
                      {pedido.vehiculo
                        ? `${pedido.vehiculo.tipo} (${pedido.vehiculo.placa})`
                        : pedido.id_vehiculo
                          ? `Vehículo #${pedido.id_vehiculo}`
                          : "—"}
                    </span>
                  </div>
                </div>

                {historial.length > 0 && (
                  <div className="inicio-historial">
                    <b className="inicio-historial-titulo">Historial de la entrega</b>
                    <div className="inicio-historial-lista">
                      {historial.map((h) => {
                        const metaH = ESTADO_META[h.estado];
                        const esEntrega = h.estado === "ENTREGADO";
                        return (
                          <div className={"inicio-h-item" + (esEntrega ? " con-evidencia" : "")} key={h.id_historial}>
                            <div className="inicio-h-linea">
                              <span className="inicio-h-punto" style={{ background: metaH?.color || "#94a3b8" }} />
                              <span className="inicio-h-texto">
                                <b>{metaH?.etiqueta || h.estado}</b>
                                {h.usuario && <span className="inicio-h-usuario"> · {h.usuario}</span>}
                                <small>{formatearFecha(h.fecha)}</small>
                              </span>
                            </div>
                            {h.nota && <p className="inicio-h-nota">{h.nota}</p>}
                            {esEntrega && (h.firma || h.foto) && (
                              <div className="inicio-h-evidencias">
                                {h.firma && (
                                  <div className="inicio-h-firma">
                                    <small>Firma de recepción</small>
                                    <img src={h.firma} alt="Firma de recepción" />
                                  </div>
                                )}
                                {h.foto && (
                                  <button
                                    type="button"
                                    className="inicio-h-foto"
                                    onClick={() => setEvidencia(urlArchivo(h.foto))}
                                  >
                                    <img src={urlArchivo(h.foto)} alt="Evidencia de entrega" />
                                    <small>Ver evidencia</small>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="inicio-mapa">
                  <div ref={mapaCont} className="inicio-mapa-contenido" />
                </div>
              </div>
            )}
          </div>

      {evidencia && (
        <EvidenciaModal
          url={evidencia}
          titulo="Evidencia de entrega"
          onCerrar={() => setEvidencia(null)}
        />
      )}

      <footer className="inicio-pie">
        <span>Transporte &amp; Entregas</span>
      </footer>
    </main>
  );
}