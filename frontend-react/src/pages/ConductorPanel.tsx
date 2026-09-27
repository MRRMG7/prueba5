import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useAuth } from "../auth";
import { ESTADO_META, api, nombreCliente } from "../api";
import { ESTILO_MAPA } from "../mapa";
import type { Cliente, Pedido } from "../types";
import EstadoPill from "../components/EstadoPill";
import TarjetaConteo from "../components/TarjetaConteo";
import EntregaModal from "../components/EntregaModal";
import CambiarPasswordModal from "../components/CambiarPasswordModal";
import MenuUsuario from "../components/MenuUsuario";

const COLOR_ESTADOS: Record<string, string> = {
  PENDIENTE: "#64748b",
  ASIGNADO: "#334155",
  RECOLECTADO: "#7c3aed",
  EN_CAMINO: "#f5a623",
  ENTREGADO: "#2ec4b6",
  INCIDENCIA: "#f36c2e",
  CANCELADO: "#ef4b4b",
};

function distanciaKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export default function ConductorPanel() {
  const { sesion, logout, setFoto } = useAuth();

  async function cambiarFoto(dataUrl: string | null) {
    const res = await api<{ foto: string | null }>("/usuario/foto", {
      method: "POST",
      body: JSON.stringify({ foto: dataUrl }),
    });
    setFoto(res.foto);
  }
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [modalEntrega, setModalEntrega] = useState<{ pedido: Pedido; modo: "entrega" | "incidencia" } | null>(null);
  const [modalPassword, setModalPassword] = useState(false);
  const [optimizado, setOptimizado] = useState<number[] | null>(null);
  const [optimizando, setOptimizando] = useState(false);
  const [mensajeOptimizacion, setMensajeOptimizacion] = useState("");
  const mapaCont = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<maplibregl.Map | null>(null);

  async function cargar() {
    const [p, c] = await Promise.all([
      api<Pedido[]>("/api/pedidos").catch(() => [] as Pedido[]),
      api<Cliente[]>("/clientes").catch(() => [] as Cliente[]),
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
    }, 10000);
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

      const pendientes = propios.filter((p) => p.estado === "EN_CAMINO");

  async function optimizarRuta() {
    const conCoords = pendientes.filter((p) => p.latitud && p.longitud);
    if (conCoords.length < 2) {
      setMensajeOptimizacion("Necesitás al menos 2 entregas con coordenadas para optimizar.");
      return;
    }
    setOptimizando(true);
    setMensajeOptimizacion("");
    const usaPosicion = navigator.geolocation
      ? await new Promise<{ lat: number; lon: number } | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
            () => resolve(null),
            { timeout: 4000, maximumAge: 120000 },
          );
        })
      : null;

    const puntos = conCoords.map((p) => ({
      id: p.id_pedido,
      lat: Number(p.latitud),
      lon: Number(p.longitud),
      visitado: false,
    }));

    const orden: number[] = [];
    const inicio = usaPosicion ? { lat: usaPosicion.lat, lon: usaPosicion.lon } : { lat: puntos[0].lat, lon: puntos[0].lon };
    let actual = inicio;
    for (let i = 0; i < puntos.length; i++) {
      let mejor: (typeof puntos)[number] | null = null;
      let mejorDist = Infinity;
      for (const pt of puntos) {
        if (pt.visitado) continue;
        const d = distanciaKm({ lat: actual.lat, lon: actual.lon }, { lat: pt.lat, lon: pt.lon });
        if (d < mejorDist) {
          mejorDist = d;
          mejor = pt;
        }
      }
      if (!mejor) break;
      mejor.visitado = true;
      orden.push(mejor.id);
      actual = { lat: mejor.lat, lon: mejor.lon };
    }
    setOptimizado(orden);
    setMensajeOptimizacion(
      usaPosicion
        ? "Ruta ordenada desde tu posición actual — la entrega más cercana primero."
        : "Ruta ordenada desde la primera entrega: seguí el orden numerado.",
    );
    setOptimizando(false);
  }

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
    porRecolectar: propios.filter((p) => p.estado === "ASIGNADO").length,
    recolectados: propios.filter((p) => p.estado === "RECOLECTADO").length,
    enCamino: propios.filter((p) => p.estado === "EN_CAMINO").length,
    entregados: propios.filter((p) => p.estado === "ENTREGADO").length,
    incidencias: propios.filter((p) => p.estado === "INCIDENCIA").length,
  };

  const porRecolectar = propios
    .filter((p) => p.estado === "ASIGNADO")
    .sort((a, b) => a.id_pedido - b.id_pedido);
  const recolectados = propios
    .filter((p) => p.estado === "RECOLECTADO")
    .sort((a, b) => a.id_pedido - b.id_pedido);
  const enRuta = propios.filter(
    (p) => p.estado === "EN_CAMINO" || p.estado === "INCIDENCIA" || p.estado === "ENTREGADO",
  );

  const [codigo, setCodigo] = useState("");
  const [recolectandoId, setRecolectandoId] = useState<number | null>(null);
  const [msgRecolecta, setMsgRecolecta] = useState("");
  const [enviandoId, setEnviandoId] = useState<number | null>(null);

  async function recolectarPedido(p: Pedido) {
    setMsgRecolecta("");
    if (!codigo.trim()) {
      setMsgRecolecta("Ingresá el código de recolecta.");
      return;
    }
    setRecolectandoId(p.id_pedido);
    try {
      await api(`/pedidos/${p.id_pedido}/recolectar`, {
        method: "POST",
        body: JSON.stringify({ codigo: codigo.trim() }),
      });
      setCodigo("");
      await cargar();
    } catch (err) {
      setMsgRecolecta(err instanceof Error ? err.message : "No se pudo recolectar");
    } finally {
      setRecolectandoId(null);
    }
  }

  async function pasarAEntrega(p: Pedido) {
    setEnviandoId(p.id_pedido);
    try {
      await api(`/pedidos/${p.id_pedido}/iniciar-entrega`, { method: "POST" });
      await cargar();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo iniciar la entrega");
    } finally {
      setEnviandoId(null);
    }
  }

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
          <MenuUsuario
            nombre={sesion?.nombre}
            usuario={sesion?.usuario}
            rol="Conductor"
            foto={sesion?.foto}
            onCambiarFoto={cambiarFoto}
            onCambiarPassword={() => setModalPassword(true)}
            onCerrarSesion={logout}
          />
        </div>
      </header>

      <main className="conductor-cuerpo">
        <h1 className="conductor-saludo">Mis entregas</h1>
        <p className="conductor-saludo-sub">
          Actualizá el estado de cada entrega a medida que avanzás con tu ruta.
        </p>

        <div className="fila-conteos">
          <TarjetaConteo valor={conteos.porRecolectar} etiqueta="Por recolectar" color="#334155" />
          <TarjetaConteo valor={conteos.recolectados} etiqueta="Recolectados" color="#7c3aed" />
          <TarjetaConteo valor={conteos.enCamino} etiqueta="En camino" color="#f5a623" />
          <TarjetaConteo valor={conteos.entregados} etiqueta="Entregados" color="#2ec4b6" />
          <TarjetaConteo valor={conteos.incidencias} etiqueta="Incidencias" color="#f36c2e" />
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
            <h2>Por recolectar</h2>
            <p>Recolectá los paquetes en el comercio. Van en orden de llegada.</p>
          </div>
          <div className="cuerpo-tarjeta">
            {porRecolectar.length === 0 && (
              <p className="entrega-vacio">No tenés paquetes por recolectar.</p>
            )}
            {porRecolectar.map((p, i) => (
              <div className="entrega-card" key={p.id_pedido}>
                <div className="entrega-top">
                  <span className="entrega-orden">{i + 1}</span>
                  <EstadoPill estado={p.estado} />
                </div>
                <p className="entrega-cliente">{nombreCliente(p, clientes)}</p>
                <p className="entrega-dir">{p.direccion}</p>
                <div className="entrega-acciones">
                  <p className="entrega-dir" style={{ margin: "0 0 6px" }}>
                    Pedí el código de recolecta al comercio e ingresalo para confirmar.
                  </p>
                  <div className="fila-acciones" style={{ flexWrap: "wrap" }}>
                    <input
                      className="campo-auditoria"
                      style={{ maxWidth: 160, marginBottom: 0 }}
                      type="text"
                      placeholder="Código R-####"
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value)}
                    />
                    <button
                      className="btn btn-verde"
                      onClick={() => recolectarPedido(p)}
                      disabled={recolectandoId === p.id_pedido}
                    >
                      {recolectandoId === p.id_pedido ? "Validando…" : "Recolectar"}
                    </button>
                    <button
                      className="btn btn-rojo"
                      onClick={() => setModalEntrega({ pedido: p, modo: "incidencia" })}
                    >
                      Incidencia
                    </button>
                  </div>
                  {msgRecolecta && <p className="error-login" style={{ marginTop: 6 }}>{msgRecolecta}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="tarjeta">
          <div className="cabecera-tarjeta">
            <h2>Paquetes recolectados</h2>
            <p>Ya los tenés en tu poder. Pasalos a entrega cuando salgas a ruta.</p>
          </div>
          <div className="cuerpo-tarjeta">
            {recolectados.length === 0 && (
              <p className="entrega-vacio">Todavía no recolectaste ningún paquete.</p>
            )}
            {recolectados.map((p) => (
              <div className="entrega-card" key={p.id_pedido}>
                <div className="entrega-top">
                  <span className="codigo-tracking">#{p.id_pedido}</span>
                  <EstadoPill estado={p.estado} />
                </div>
                <p className="entrega-cliente">{nombreCliente(p, clientes)}</p>
                <p className="entrega-dir">{p.direccion}</p>
                <div className="entrega-acciones">
                  <button
                    className="btn btn-ambar"
                    onClick={() => pasarAEntrega(p)}
                    disabled={enviandoId === p.id_pedido}
                  >
                    {enviandoId === p.id_pedido ? "Enviando…" : "Pasar a entrega"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="tarjeta">
          <div className="cabecera-tarjeta">
            <h2>Lista de entregas</h2>
            <p>
              {optimizado
                ? "Seguí el orden numerado para ahorrar tiempo y km."
                : "Avanzá con la entrega o reportá una incidencia."}
            </p>
          </div>
          <div className="cuerpo-tarjeta">
            <div className="ruta-toolbar">
              <button
                type="button"
                className="btn btn-ambar"
                onClick={optimizarRuta}
                disabled={optimizando}
              >
                {optimizando ? "Calculando…" : optimizado ? "Reoptimizar ruta" : "Optimizar ruta"}
              </button>
              {optimizado && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => setOptimizado(null)}
                >
                  Ver orden normal
                </button>
              )}
            </div>
            {mensajeOptimizacion && <p className="aviso-banner ambar">{mensajeOptimizacion}</p>}
            {!mensajeOptimizacion && optimizado && (
              <p className="aviso-banner ambar">Orden optimizado: {optimizado.length} entregas.</p>
            )}

            {enRuta.length === 0 && (
              <p className="entrega-vacio">
                No tenés entregas en ruta. Mové un paquete recolectado a "Pasar a entrega".
              </p>
            )}
            {enRuta
              .slice()
              .sort((a, b) => {
                if (!optimizado) return 0;
                return optimizado.indexOf(a.id_pedido) - optimizado.indexOf(b.id_pedido);
              })
              .map((p) => {
                const indice = optimizado ? optimizado.indexOf(p.id_pedido) : -1;
                return (
                  <div className="entrega-card" key={p.id_pedido}>
                    <div className="entrega-top">
                      {indice >= 0 ? (
                        <span className="entrega-orden">{indice + 1}</span>
                      ) : (
                        <span className="codigo-tracking">#{p.id_pedido}</span>
                      )}
                      <EstadoPill estado={p.estado} />
                    </div>
                    <p className="entrega-cliente">{nombreCliente(p, clientes)}</p>
                    <p className="entrega-dir">{p.direccion}</p>
                    <div className="entrega-acciones">
                      {p.estado === "EN_CAMINO" && (
                        <>
                          <button
                            className="btn btn-verde"
                            onClick={() => setModalEntrega({ pedido: p, modo: "entrega" })}
                          >
                            Marcar entregado
                          </button>
                          <button
                            className="btn btn-rojo"
                            onClick={() => setModalEntrega({ pedido: p, modo: "incidencia" })}
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
                );
              })}
          </div>
        </section>
      </main>

      {modalEntrega && (
        <EntregaModal
          pedido={modalEntrega.pedido}
          modoInicial={modalEntrega.modo}
          onCerrar={() => setModalEntrega(null)}
          onGuardado={cargar}
        />
      )}

      {modalPassword && <CambiarPasswordModal onCerrar={() => setModalPassword(false)} />}
    </div>
  );
}