import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ESTADO_META, nombreCliente } from "../../api";
import { geocodificar, geocodificarInversa } from "../../geo";
import { ESTILO_MAPA } from "../../mapa";
import type { Cliente, Conductor, Pedido, Vehiculo } from "../../types";
import FormPedido from "./FormPedido";

const COLOR_ESTADOS: Record<string, string> = {
  PENDIENTE: "#64748b",
  ASIGNADO: "#334155",
  EN_CAMINO: "#f5a623",
  ENTREGADO: "#2ec4b6",
  INCIDENCIA: "#f36c2e",
  CANCELADO: "#ef4b4b",
};
const COORDS_PIN = [-89.2182, 13.6929] as [number, number];

interface Props {
  pedidos: Pedido[];
  clientes: Cliente[];
  conductores: Conductor[];
  vehiculos: Vehiculo[];
  onCambio: () => Promise<void>;
}

export default function MapaTab({ pedidos, clientes, conductores, vehiculos, onCambio }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<maplibregl.Map | null>(null);
  const pinRef = useRef<maplibregl.Marker | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [coords, setCoords] = useState({ lat: COORDS_PIN[1], lng: COORDS_PIN[0] });
  const coordsRef = useRef(coords);
  coordsRef.current = coords;
  const pedidosRef = useRef(pedidos);
  pedidosRef.current = pedidos;
  const clientesRef = useRef(clientes);
  clientesRef.current = clientes;

  const actualizarCoords = useCallback((lat: number, lng: number) => {
    setCoords({ lat, lng });
    geocodificarInversa(lat, lng).then((dir) => {
      setMensaje(dir || `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    });
  }, []);

  useEffect(() => {
    if (!contenedor.current || mapaRef.current) return;
    const mapa = new maplibregl.Map({
      container: contenedor.current,
      style: ESTILO_MAPA,
      center: [-88.9, 13.7],
      zoom: 7,
    });
    mapa.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapa.on("error", (e) => {
      if (e.error && e.error.message && e.error.message.indexOf("Source") !== -1) {
        setMensaje("No se pudo cargar el mapa. Revisá tu conexión a internet.");
      }
    });
    mapa.on("load", () => {
      mapaRef.current = mapa;
      const pin = new maplibregl.Marker({ color: "#e53e3e", draggable: true })
        .setLngLat(COORDS_PIN)
        .addTo(mapa);
      pinRef.current = pin;
      pin.on("dragend", () => {
        const { lat, lng } = pin.getLngLat();
        actualizarCoords(lat, lng);
      });
      mapa.on("click", (e) => {
        pin.setLngLat(e.lngLat);
        actualizarCoords(e.lngLat.lat, e.lngLat.lng);
      });
      actualizarCoords(COORDS_PIN[1], COORDS_PIN[0]);
      encuadrarPedidosActivos(mapa, pedidosRef.current, clientesRef.current);
    });
    return () => {
      mapa.remove();
      mapaRef.current = null;
      pinRef.current = null;
    };
  }, [actualizarCoords]);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    // marcadores de pedidos activos
    for (const nombre of ["marcadores-pedidos"]) {
      const borne = (mapa as unknown as Record<string, unknown>)[nombre];
      if (Array.isArray(borne)) {
        for (const m of borne as maplibregl.Marker[]) m.remove();
      }
    }
    const marcadores: maplibregl.Marker[] = [];
    pedidos
      .filter((p) => p.estado !== "CANCELADO" && p.latitud && p.longitud)
      .forEach((p) => {
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
    (mapa as unknown as Record<string, maplibregl.Marker[]>).marcadoresPedidos = marcadores;
  }, [pedidos, clientes]);

  async function buscar(e: FormEvent) {
    e.preventDefault();
    const texto = busqueda.trim();
    if (!texto) return;
    setMensaje("Buscando…");
    try {
      const res = await geocodificar(texto);
      pinRef.current?.setLngLat([res.lon, res.lat]);
      actualizarCoords(res.lat, res.lon);
      setMensaje(res.nombre || `${res.lat.toFixed(6)}, ${res.lon.toFixed(6)}`);
    } catch {
      setMensaje(`No encontramos "${texto}" en El Salvador.`);
    }
  }

  return (
    <div>
      <section className="tarjeta">
        <div className="cabecera-tarjeta">
          <h2>Geolocalizar en El Salvador</h2>
          <p>Buscá una dirección, o marcá el punto de entrega con el pin rojo.</p>
        </div>
        <div className="cuerpo-tarjeta">
          <div className="fila-acciones" style={{ marginBottom: 12 }}>
            <form onSubmit={buscar} className="campo" style={{ display: "flex", gap: 8, flex: 1 }}>
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar dirección en El Salvador…"
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-ambar">
                Buscar Ubicación
              </button>
            </form>
            <button onClick={() => setNuevo(true)} className="btn btn-verde">
              + Registrar pedido
            </button>
          </div>

          <div className="mapa-wrap">
            <div ref={contenedor} className="h-[440px] w-full" />
          </div>

          {mensaje && <p style={{ marginTop: 10 }} className="aviso-banner ambar">{mensaje}</p>}
        </div>
      </section>

      {nuevo && (
        <FormPedido
          clientes={clientes}
          conductores={conductores}
          vehiculos={vehiculos}
          iniciales={{ latitud: coords.lat, longitud: coords.lng, direccion: mensaje }}
          onCerrar={() => setNuevo(false)}
          onGuardado={onCambio}
        />
      )}
    </div>
  );
}

function encuadrarPedidosActivos(
  mapa: maplibregl.Map,
  pedidos: Pedido[],
  _clientes: Cliente[],
) {
  const activos = pedidos.filter(
    (p) => p.estado !== "CANCELADO" && p.estado !== "ENTREGADO" && p.latitud && p.longitud,
  );
  if (!activos.length) return;
  const conCoordenadas = activos.map((p) => [p.longitud, p.latitud] as [number, number]);
  if (conCoordenadas.length === 1) {
    mapa.setCenter(conCoordenadas[0]);
    mapa.setZoom(12);
    return;
  }
  const bounds = new maplibregl.LngLatBounds();
  for (const c of conCoordenadas) bounds.extend(c);
  mapa.fitBounds(bounds, { padding: 64, maxZoom: 13 });
}