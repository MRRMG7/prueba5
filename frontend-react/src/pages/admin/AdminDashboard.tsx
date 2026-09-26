import { useEffect, useState } from "react";
import { useAuth } from "../../auth";
import { api } from "../../api";
import type { Cliente, Conductor, Pedido, Vehiculo } from "../../types";
import PaquetesTab from "./PaquetesTab";
import ConductoresTab from "./ConductoresTab";
import VehiculosTab from "./VehiculosTab";
import ClientesTab from "./ClientesTab";

type Seccion = "resumen" | "paquetes" | "conductores" | "vehiculos" | "clientes";

const CONTEOS_COLORES: Record<string, string> = {
  PENDIENTE: "#64748b",
  ASIGNADO: "#334155",
  EN_CAMINO: "#f5a623",
  ENTREGADO: "#2ec4b6",
  INCIDENCIA: "#f36c2e",
  CANCELADO: "#ef4b4b",
  sinAsignar: "#94a3b8",
};

const CONTEOS_LABEL: Record<string, string> = {
  PENDIENTE: "Pendientes",
  ASIGNADO: "Asignados",
  EN_CAMINO: "En camino",
  ENTREGADO: "Entregados",
  INCIDENCIA: "Incidencias",
  CANCELADO: "Cancelados",
  sinAsignar: "Sin asignar",
};

const TITULOS: Record<Seccion, string> = {
  resumen: "Panel de administración",
  paquetes: "Paquetes",
  conductores: "Conductores",
  vehiculos: "Vehículos",
  clientes: "Clientes",
};

function Icono({ id }: { id: Seccion }) {
  const comunes = { width: 18, height: 18 } as const;
  switch (id) {
    case "resumen":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...comunes}>
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      );
    case "paquetes":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...comunes}>
          <path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z" />
          <path d="M3.3 7l8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </svg>
      );
    case "conductores":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...comunes}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "vehiculos":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...comunes}>
          <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" />
          <path d="M3 16v-3a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3" />
          <path d="M5 16h14v2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-2z" />
          <circle cx="7.5" cy="13.5" r="1" />
          <circle cx="16.5" cy="13.5" r="1" />
        </svg>
      );
    case "clientes":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...comunes}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
  }
}

export default function AdminDashboard() {
  const { sesion, logout } = useAuth();
  const [seccion, setSeccion] = useState<Seccion>("resumen");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  async function cargar() {
    const [c, cond, v, p] = await Promise.all([
      api<Cliente[]>("/clientes"),
      api<Conductor[]>("/conductores"),
      api<Vehiculo[]>("/vehiculos"),
      api<Pedido[]>("/pedidos"),
    ]);
    setClientes(c || []);
    setConductores(cond || []);
    setVehiculos(v || []);
    setPedidos((p || []).map((x) => ({ ...x, latitud: Number(x.latitud || 0) })));
  }

  useEffect(() => {
    cargar().catch(() => {});
    const id = setInterval(() => {
      if (!document.hidden) cargar().catch(() => {});
    }, 3000);
    return () => clearInterval(id);
  }, []);

  if (!sesion) return null;

  const conteos = {
    PENDIENTE: pedidos.filter((p) => p.estado === "PENDIENTE").length,
    ASIGNADO: pedidos.filter((p) => p.estado === "ASIGNADO").length,
    EN_CAMINO: pedidos.filter((p) => p.estado === "EN_CAMINO").length,
    ENTREGADO: pedidos.filter((p) => p.estado === "ENTREGADO").length,
    INCIDENCIA: pedidos.filter((p) => p.estado === "INCIDENCIA").length,
    CANCELADO: pedidos.filter((p) => p.estado === "CANCELADO").length,
    sinAsignar: pedidos.filter((p) => !p.id_conductor).length,
  };

  const navegacion: { id: Seccion; label: string }[] = [
    { id: "resumen", label: "Resumen" },
    { id: "paquetes", label: "Paquetes" },
    { id: "conductores", label: "Conductores" },
    { id: "vehiculos", label: "Vehículos" },
    { id: "clientes", label: "Clientes" },
  ];

  return (
    <div className="side-layout">
      <aside className="sidebar">
        <div className="side-marca marca">
          <span className="marca-icono" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="22" height="22">
              <path d="M4 20 C 9 8, 18 22, 28 6" fill="none" stroke="#2ec4b6" strokeWidth="2.6" strokeLinecap="round" />
              <circle cx="4" cy="20" r="3" fill="#f5a623" />
              <circle cx="28" cy="6" r="3" fill="#f5a623" />
            </svg>
          </span>
          <span className="marca-texto">Transporte &amp; Entregas</span>
        </div>

        <nav className="side-nav">
          {navegacion.map((n) => (
            <button
              key={n.id}
              onClick={() => setSeccion(n.id)}
              className={"side-link" + (seccion === n.id ? " activo" : "")}
            >
              <Icono id={n.id} />
              {n.label}
            </button>
          ))}
        </nav>

        <div className="side-pie">
          <p className="side-usuario">
            {sesion.nombre}
            <br />
            Administrador · @{sesion.usuario}
          </p>
          <button className="salir-side" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="side-contenido">
        <div className="panel">
          <div className="panel-top">
            <span className="rol-etiqueta">Administrador</span>
            <h1 className="panel-titulo">{TITULOS[seccion]}</h1>
            <button className="btn salir" onClick={logout}>
              Salir
            </button>
          </div>

          {seccion === "resumen" && (
            <>
              <div className="fila-conteos">
                {Object.keys(conteos).map((k) => (
                  <span className="contador" key={k}>
                    <span className="punto" style={{ background: CONTEOS_COLORES[k] }} />
                    {CONTEOS_LABEL[k]}: <b>{conteos[k as keyof typeof conteos]}</b>
                  </span>
                ))}
              </div>

              <section className="tarjeta">
                <div className="cabecera-tarjeta">
                  <h2>Reparto por conductor</h2>
                  <p>Pedidos que lleva cada conductor, entregados y con incidencias.</p>
                </div>
                <div className="cuerpo-tarjeta">
                  <div className="overflow">
                    <table className="tabla">
                      <thead>
                        <tr>
                          <th>Conductor</th>
                          <th>En ruta</th>
                          <th>Entregados</th>
                          <th>Incidencias</th>
                          <th>Licencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {conductores.length === 0 && (
                          <tr>
                            <td colSpan={5} className="celda-suave" style={{ textAlign: "center", padding: "28px 12px" }}>
                              No hay conductores registrados.
                            </td>
                          </tr>
                        )}
                        {conductores.map((c) => {
                          const de = pedidos.filter((p) => p.id_conductor === c.id_conductor);
                          return (
                            <tr key={c.id_conductor}>
                              <td className="celda-fuerte">{c.nombre}</td>
                              <td>{de.filter((p) => p.estado === "EN_CAMINO").length}</td>
                              <td>{de.filter((p) => p.estado === "ENTREGADO").length}</td>
                              <td>{de.filter((p) => p.estado === "INCIDENCIA").length}</td>
                              <td className="celda-suave">{c.licencia || "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </>
          )}

          {seccion === "paquetes" && (
            <PaquetesTab
              pedidos={pedidos}
              clientes={clientes}
              conductores={conductores}
              vehiculos={vehiculos}
              onCambio={cargar}
            />
          )}
          {seccion === "conductores" && <ConductoresTab conductores={conductores} onCambio={cargar} />}
          {seccion === "vehiculos" && <VehiculosTab vehiculos={vehiculos} onCambio={cargar} />}
          {seccion === "clientes" && <ClientesTab clientes={clientes} pedidos={pedidos} onCambio={cargar} />}
        </div>
      </main>
    </div>
  );
}