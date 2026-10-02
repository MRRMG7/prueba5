import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { ESTADO_META, api, nombreCliente, nombreConductor, formatearFecha, urlArchivo } from "../api";
import type { Cliente, Pedido, HistorialEntrega, Conductor } from "../types";
import EstadoPill from "../components/EstadoPill";
import TarjetaConteo from "../components/TarjetaConteo";
import MenuUsuario from "../components/MenuUsuario";
import CambiarPasswordModal from "../components/CambiarPasswordModal";
import EvidenciaModal from "../components/EvidenciaModal";
import FormPedido from "./admin/FormPedido";

export default function ProveedorPanel() {
  const { sesion, logout, setFoto } = useAuth();
const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [historial, setHistorial] = useState<HistorialEntrega[]>([]);
  const [historialDe, setHistorialDe] = useState<number | null>(null);
  const [evidencia, setEvidencia] = useState<string | null>(null);
  const [modalPassword, setModalPassword] = useState(false);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [filtro, setFiltro] = useState("");

  async function cargar() {
    const [p, c, cond] = await Promise.all([
      api<Pedido[]>("/api/pedidos").catch(() => [] as Pedido[]),
      api<Cliente[]>("/clientes").catch(() => [] as Cliente[]),
      api<Conductor[]>("/conductores").catch(() => [] as Conductor[]),
    ]);
    setPedidos(
      (p || []).map((x) => ({
        ...x,
        latitud: Number(x.latitud || 0),
        longitud: Number(x.longitud || 0),
      })),
    );
    setClientes(c || []);
    setConductores(cond || []);
  }

  useEffect(() => {
    cargar().catch(() => {});
    const id = setInterval(() => {
      if (!document.hidden) cargar().catch(() => {});
    }, 10000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verHistorial(id: number) {
    setHistorialDe(id);
    setHistorial([]);
    try {
      const h = await api<HistorialEntrega[]>(`/pedidos/${id}/historial`);
      setHistorial(h || []);
    } catch {
      setHistorial([]);
    }
  }

  async function cambiarFoto(dataUrl: string | null) {
    const res = await api<{ foto: string | null }>("/usuario/foto", {
      method: "POST",
      body: JSON.stringify({ foto: dataUrl }),
    });
    setFoto(res.foto);
  }

  const visibles = pedidos.filter((p) => {
    const q = filtro.trim().toLowerCase();
    if (!q) return true;
    return `${p.id_pedido} ${p.direccion} ${p.estado}`.toLowerCase().includes(q);
  });

  const conteos = {
    pendientes: pedidos.filter(
      (p) => p.estado === "PENDIENTE" || p.estado === "ASIGNADO" || p.estado === "RECOLECTADO",
    ).length,
    recolectados: pedidos.filter((p) => p.estado === "RECOLECTADO").length,
    entregados: pedidos.filter((p) => p.estado === "ENTREGADO").length,
    incidencias: pedidos.filter((p) => p.estado === "INCIDENCIA").length,
  };

  return (
    <div className="conductor">
      <header className="conductor-top">
        <div className="marca">
          <span className="marca-icono" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="22" height="22">
              <path d="M4 20 C 9 8, 18 22, 28 6" fill="none" stroke="#94a3b8" strokeWidth="2.6" strokeLinecap="round" />
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
            rol="Proveedor"
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
          Mandá el paquete de tus clientes y seguí cada envío. El administrador aprueba y asigna el conductor.
        </p>

        <div className="fila-conteos">
          <TarjetaConteo valor={conteos.pendientes} etiqueta="En proceso" color="#334155" />
          <TarjetaConteo valor={conteos.recolectados} etiqueta="Recolectados" color="#7c3aed" />
          <TarjetaConteo valor={conteos.entregados} etiqueta="Entregados" color="#16a34a" />
          <TarjetaConteo valor={conteos.incidencias} etiqueta="Incidencias" color="#f36c2e" />
        </div>

        <section className="tarjeta">
          <div className="cabecera-tarjeta">
            <h2>Lista de pedidos</h2>
            <p>Todos los envíos creados por tu comercio.</p>
          </div>
          <div className="cuerpo-tarjeta">
            <div className="ruta-toolbar">
              <button type="button" className="btn btn-verde" onClick={() => setModalNuevo(true)}>
                + Crear pedido
              </button>
              <input
                className="campo-auditoria"
                style={{ flex: 1, minWidth: 200, marginBottom: 0 }}
                type="search"
                placeholder="Filtrar por nº, dirección o estado…"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
            </div>

            {pedidos.length === 0 && (
              <p className="entrega-vacio">
                Todavía no tenés pedidos. Creá el primero con el botón "+ Crear pedido".
              </p>
            )}

            {visibles.map((p) => {
              return (
                <div className="entrega-card" key={p.id_pedido}>
                  <div className="entrega-top">
                    <span className="codigo-tracking">#{p.id_pedido}</span>
                    <EstadoPill estado={p.estado} />
                  </div>
                  <p className="entrega-cliente">Cliente: {nombreCliente(p, clientes)}</p>
                  <p className="entrega-dir">{p.direccion}</p>
                  {p.estado === "PENDIENTE" && (
                    <p className="entrega-dir" style={{ fontStyle: "italic" }}>
                      Esperando aprobación del administrador.
                    </p>
                  )}
                  {p.codigo_recolecta && p.estado !== "PENDIENTE" && (
                    <p className="entrega-dir">
                      Código de recolecta: <span className="codigo-tracking">{p.codigo_recolecta}</span>
                    </p>
                  )}
                  <p className="entrega-dir">
                    {nombreConductor(p, conductores)}
                    {p.vehiculo ? ` · ${p.vehiculo.tipo} (${p.vehiculo.placa})` : ""}
                    {p.entregado_at ? ` · ${formatearFecha(p.entregado_at)}` : ""}
                  </p>
                  <div className="entrega-acciones">
                    <button type="button" className="btn" onClick={() => verHistorial(p.id_pedido)}>
                      Historial
                    </button>
                    {p.foto_entrega && (
                      <button type="button" className="btn btn-ambar" onClick={() => setEvidencia(urlArchivo(p.foto_entrega))}>
                        📷 Ver evidencia
                      </button>
                    )}
                    {p.estado === "INCIDENCIA" && p.incidencia_nota && (
                      <span className="entrega-dir" style={{ margin: 0, fontStyle: "italic" }}>
                        {p.incidencia_nota}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {modalNuevo && (
        <FormPedido
          datosCliente
          conductores={[]}
          vehiculos={[]}
          onCerrar={() => setModalNuevo(false)}
          onGuardado={cargar}
        />
      )}

      {historialDe !== null && (
        <div className="modal-fondo" onClick={() => setHistorialDe(null)}>
          <div className="modal-caja" onClick={(e) => e.stopPropagation()}>
            <div className="modal-cabecera">
              <div>
                <h3 className="modal-titulo">Historial del pedido #{historialDe}</h3>
                <p className="modal-sub">Etapas por las que pasó la entrega.</p>
              </div>
              <button type="button" className="modal-cerrar" onClick={() => setHistorialDe(null)}>
                ✕
              </button>
            </div>
            {historial.length === 0 && <p className="celda-suave">Cargando historial…</p>}
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
                    {esEntrega && h.firma && (
                      <div className="inicio-h-firma">
                        <small>Firma de recepción</small>
                        <img src={h.firma} alt="Firma de recepción" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {evidencia && (
        <EvidenciaModal url={evidencia} titulo="Evidencia de entrega" onCerrar={() => setEvidencia(null)} />
      )}

      {modalPassword && <CambiarPasswordModal onCerrar={() => setModalPassword(false)} />}
    </div>
  );
}