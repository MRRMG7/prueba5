import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useAuth } from "../auth";
import { ESTADO_META, api, nombreCliente } from "../api";
import { ESTILO_MAPA } from "../mapa";
import type { Cliente, Pedido } from "../types";
import EstadoPill from "../components/EstadoPill";

const COLOR_ESTADOS: Record<string, string> = {
  PENDIENTE: "#64748b",
  ASIGNADO: "#334155",
  EN_CAMINO: "#f5a623",
  ENTREGADO: "#2ec4b6",
  INCIDENCIA: "#f36c2e",
  CANCELADO: "#ef4b4b",
};

export default function ConductorPanel() {
  const { sesion, logout } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const mapaCont = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<maplibregl.Map | null>(null);

  async function cargar() {
    const [p, c] = await Promise.all([
      api<Pedido[]>("/pedidos"),
      api<Cliente[]>("/clientes"),
    ]);
    setClientes(c || []);
    setPedidos(
      (p || []).map((x) => ({
        ...x,
        latitud: Number(x.latitud || 0),
        longitud: Number(x.longitud || 0),
      })),
    );
  }

  useEffect(() => {
    cargar().catch(() => {});
    const id = setInterval(() => {
      if (!document.hidden) cargar().catch(() => {});
    }, 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!mapaCont.current || mapaRef.current) return;
    const mapa = new maplibregl.Map({
      container: mapaCont.current,
      style: ESTILO_MAPA,
      center: [-89.2, 13.69],
      zoom: 8,
    });
    mapaRef.current = mapa;
    return () => {
      mapa.remove();
      mapaRef.current = null;
    };
  }, []);

  const propios = sesion?.id_ref ? pedidos.filter((p) => p.id_conductor === sesion.id_ref) : [];

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    const prev = (mapa as unknown as Record<string, unknown>).marcadores;
    if (Array.isArray(prev)) {
      for (const m of prev as maplibregl.Marker[]) m.remove();
    }
    const marcadores: maplibregl.Marker[] = [];
    const conCoordenadas = propios.filter((p) => p.latitud && p.longitud);
    conCoordenadas.forEach((p) => {
      const etiqueta = (ESTADO_META[p.estado] || {}).etiqueta || p.estado;
      const popup = new maplibregl.Popup({ offset: 26, closeButton: false }).setHTML(
        `<b>#${p.id_pedido} · ${nombreCliente(p, clientes)}</b><br/>` +
          `<span style="font-size:11px">${etiqueta} · ${p.direccion}</span>`,
      );
      marcadores.push(
        new maplibregl.Marker({ color: COLOR_ESTADOS[p.estado] || "#f5a623" })
          .setLngLat([p.longitud, p.latitud])
          .setPopup(popup)
          .addTo(mapa),
      );
    });
    (mapa as unknown as Record<string, maplibregl.Marker[]>).marcadores = marcadores;
    if (conCoordenadas.length === 1) {
      mapa.setCenter([conCoordenadas[0].longitud, conCoordenadas[0].latitud]);
      mapa.setZoom(12);
      return;
    }
    if (conCoordenadas.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      conCoordenadas.forEach((p) => bounds.extend([p.longitud, p.latitud]));
      mapa.fitBounds(bounds, { padding: 50, maxZoom: 13 });
    }
  }, [propios, clientes]);

  async function cambiarEstado(p: Pedido, estado: Pedido["estado"], mensaje: string) {
    if (!confirm(mensaje)) return;
    try {
      await api(`/pedidos/${p.id_pedido}/estado`, {
        method: "PUT",
        body: JSON.stringify({ estado }),
      });
      await cargar();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error");
    }
  }

  const conteos = {
    porEntregar: propios.filter((p) => p.estado === "ASIGNADO").length,
    enCamino: propios.filter((p) => p.estado === "EN_CAMINO").length,
    entregados: propios.filter((p) => p.estado === "ENTREGADO").length,
    incidencias: propios.filter((p) => p.estado === "INCIDENCIA").length,
  };

  return (
    <div className="conductor">
      <header className="conductor-top">
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
        <div className="conductor-usuario">
          <span>{sesion?.nombre}</span>
          <button type="button" className="conductor-btn-salir" onClick={logout}>
            Salir
          </button>
        </div>
      </header>

      <main className="conductor-cuerpo">
        <h1 className="conductor-saludo">Mis entregas</h1>
        <p className="conductor-saludo-sub">
          Actualizá el estado de cada entrega a medida que avanzás con tu ruta.
        </p>

        <div className="fila-conteos">
          <span className="contador">
            <span className="punto" style={{ background: "#334155" }} />
            Por entregar: <b>{conteos.porEntregar}</b>
          </span>
          <span className="contador">
            <span className="punto" style={{ background: "#f5a623" }} />
            En camino: <b>{conteos.enCamino}</b>
          </span>
          <span className="contador">
            <span className="punto" style={{ background: "#2ec4b6" }} />
            Entregados: <b>{conteos.entregados}</b>
          </span>
          <span className="contador">
            <span className="punto" style={{ background: "#f36c2e" }} />
            Incidencias: <b>{conteos.incidencias}</b>
          </span>
        </div>

        <section className="tarjeta">
          <div className="cabecera-tarjeta">
            <h2>Mapa de mis entregas</h2>
            <p>Estos son los puntos de entrega que tenés asignados.</p>
          </div>
          <div className="cuerpo-tarjeta">
            <div className="mapa-wrap">
              <div ref={mapaCont} style={{ height: 260 }} />
            </div>
          </div>
        </section>

        <section className="tarjeta">
          <div className="cabecera-tarjeta">
            <h2>Lista de entregas</h2>
            <p>Avanzá con la entrega o reportá una incidencia.</p>
          </div>
          <div className="cuerpo-tarjeta">
            {propios.length === 0 && (
              <p className="entrega-vacio">
                No tenés entregas asignadas por el momento. El administrador te asignará pedidos.
              </p>
            )}
            {propios.map((p) => (
              <div className="entrega-card" key={p.id_pedido}>
                <div className="entrega-top">
                  <span className="codigo-tracking">#{p.id_pedido}</span>
                  <EstadoPill estado={p.estado} />
                </div>
                <p className="entrega-cliente">{nombreCliente(p, clientes)}</p>
                <p className="entrega-dir">{p.direccion}</p>
                <div className="entrega-acciones">
                  {p.estado === "ASIGNADO" && (
                    <button
                      className="btn btn-verde"
                      onClick={() =>
                        cambiarEstado(p, "EN_CAMINO", `¿Comenzar la entrega #${p.id_pedido}?`)
                      }
                    >
                      Comenzar entrega
                    </button>
                  )}
                  {p.estado === "EN_CAMINO" && (
                    <>
                      <button
                        className="btn btn-verde"
                        onClick={() =>
                          cambiarEstado(p, "ENTREGADO", `¿Marcar #${p.id_pedido} como entregado?`)
                        }
                      >
                        Marcar entregado
                      </button>
                      <button
                        className="btn btn-rojo"
                        onClick={() =>
                          cambiarEstado(
                            p,
                            "INCIDENCIA",
                            `¿Reportar incidencia en #${p.id_pedido}?`,
                          )
                        }
                      >
                        Incidencia
                      </button>
                    </>
                  )}
                  {p.estado === "INCIDENCIA" && (
                    <button
                      className="btn btn-ambar"
                      onClick={() =>
                        cambiarEstado(p, "EN_CAMINO", `¿Reanudar la entrega #${p.id_pedido}?`)
                      }
                    >
                      Reanudar entrega
                    </button>
                  )}
                  {p.estado === "ENTREGADO" && (
                    <span className="entrega-listo">Entrega completada</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}