import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ESTADO_META, api, nombreCliente, nombreConductor } from "../api";
import { ESTILO_MAPA } from "../mapa";
import type { Cliente, Conductor, Pedido } from "../types";

const PASOS: { estado: Pedido["estado"]; etiqueta: string; detalle: string }[] = [
  { estado: "PENDIENTE", etiqueta: "Pedido creado", detalle: "Recibimos tu solicitud." },
  { estado: "ASIGNADO", etiqueta: "Repartidor asignado", detalle: "Ya tiene quién lo lleve." },
  { estado: "EN_CAMINO", etiqueta: "En camino", detalle: "Tu entrega va en ruta." },
  { estado: "ENTREGADO", etiqueta: "Entregado", detalle: "Recibido en destino." },
];

const AVANCE: Record<string, number> = {
  PENDIENTE: 1,
  ASIGNADO: 2,
  EN_CAMINO: 3,
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
      setDatos({ clientes: clientes || [], conductores: conductores || [] });
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
      <header className="inicio-hero">
        <div className="inicio-top">
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
          <button type="button" className="inicio-btn-acceso" onClick={onEntrar}>
            Acceso · Iniciar sesión
          </button>
        </div>

        <div className="inicio-hero-cuerpo">
          <div>
            <h1 className="inicio-titular">
              Cada pedido,
              <br />
              visible en su ruta.
            </h1>
            <p className="inicio-sub">
              Recogida y entrega puerta a puerta en El Salvador. Escribí tu número de
              seguimiento y enterate por dónde va tu entrega, en cada etapa.
            </p>

            <div className="ruta-animada inicio-ruta" aria-hidden="true">
              <svg viewBox="0 0 640 300" fill="none">
                <path
                  className="linea-base"
                  d="M 60 180 C 150 70, 250 190, 330 120 C 400 60, 500 170, 590 60"
                />
                <path
                  className="linea-flujo"
                  d="M 60 180 C 150 70, 250 190, 330 120 C 400 60, 500 170, 590 60"
                />
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
          </div>

          <div className="inicio-busqueda-card">
            <h2>Rastreá tu pedido</h2>
            <p className="inicio-busqueda-sub">
              Ingresá tu número de seguimiento para ver por dónde va.
            </p>

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

                <div className="inicio-mapa">
                  <div ref={mapaCont} className="inicio-mapa-contenido" />
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="inicio-seccion">
        <div className="inicio-seccion-interior">
          <h2>Qué hacemos</h2>
          <p className="inicio-seccion-sub">
            Conectamos a comercios y personas con el motorista correcto, y le damos a cada entrega
            un número para seguirla de principio a fin.
          </p>

          <div className="inicio-tarjetas">
            <div className="inicio-tarjeta">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z" />
                <path d="M3.3 7l8.7 5 8.7-5" />
                <path d="M12 22V12" />
              </svg>
              <h3>Recogida y entrega en el día</h3>
              <p>
                Tu paquete se recoge en el origen y llega puerta a puerta con un repartidor
                asignado desde el inicio.
              </p>
            </div>

            <div className="inicio-tarjeta">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <h3>Seguimiento en cada etapa</h3>
              <p>
                Con tu número de seguimiento ves la línea de tiempo y el punto de entrega en el
                mapa, sin necesidad de crear cuenta.
              </p>
            </div>

            <div className="inicio-tarjeta">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <h3>Un solo panel para tu empresa</h3>
              <p>
                Administradores y conductores coordinan paquetes, vehículos y repartos desde un
                mismo lugar.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="inicio-pie">
        <p>Sistema de Gestión de Transporte y Entregas · El Salvador</p>
        <button type="button" className="link-suave" onClick={onEntrar}>
          Acceso administrativo
        </button>
      </footer>
    </main>
  );
}