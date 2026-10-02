import { useEffect, useState } from "react";
import { useAuth } from "../../auth";
import { api } from "../../api";
import type { Cliente, Conductor, Pedido, Proveedor, Vehiculo } from "../../types";
import PaquetesTab from "./PaquetesTab";
import ConductoresTab from "./ConductoresTab";
import VehiculosTab from "./VehiculosTab";
import ClientesTab from "./ClientesTab";
import CambiarPasswordModal from "../../components/CambiarPasswordModal";
import MenuUsuario from "../../components/MenuUsuario";
import AuditoriaTab from "./AuditoriaTab";

type Seccion = "paquetes" | "conductores" | "vehiculos" | "clientes" | "auditoria";

const TITULOS: Record<Seccion, string> = {
  paquetes: "Paquetes",
  conductores: "Conductores",
  vehiculos: "Vehículos",
  clientes: "Clientes",
  auditoria: "Auditoría",
};

function Icono({ id }: { id: Seccion }) {
  const comunes = { width: 18, height: 18 } as const;
  switch (id) {
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
    case "auditoria":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...comunes}>
          <path d="M12 8v4l3 3" />
          <circle cx="12" cy="12" r="9" />
          <path d="M8 3.5V2" />
          <path d="M16 3.5V2" />
        </svg>
      );
  }
}

export default function AdminDashboard() {
  const { sesion, logout, setFoto } = useAuth();
  const [seccion, setSeccion] = useState<Seccion>("paquetes");
  const [modalPassword, setModalPassword] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);

  async function cambiarFoto(dataUrl: string | null) {
    const res = await api<{ foto: string | null }>("/usuario/foto", {
      method: "POST",
      body: JSON.stringify({ foto: dataUrl }),
    });
    setFoto(res.foto);
  }

  async function cargar() {
    const [c, cond, v, p, prov] = await Promise.all([
      api<Cliente[]>("/clientes"),
      api<Conductor[]>("/conductores"),
      api<Vehiculo[]>("/vehiculos"),
      api<Pedido[]>("/pedidos"),
      api<Proveedor[]>("/proveedores").catch(() => [] as Proveedor[]),
    ]);
    setClientes(c || []);
    setConductores(cond || []);
    setVehiculos(v || []);
    setProveedores(prov || []);
    setPedidos((p || []).map((x) => ({ ...x, latitud: Number(x.latitud || 0) })));
  }

  useEffect(() => {
    cargar().catch(() => {});
    const id = setInterval(() => {
      if (!document.hidden) cargar().catch(() => {});
    }, 10000);
    return () => clearInterval(id);
  }, []);

if (!sesion) return null;

const navegacion: { id: Seccion; label: string }[] = [
    { id: "paquetes", label: "Paquetes" },
    { id: "conductores", label: "Conductores" },
    { id: "vehiculos", label: "Vehículos" },
    { id: "clientes", label: "Clientes" },
    { id: "auditoria", label: "Auditoría" },
  ];

  return (
    <div className="side-layout">
      <aside className="sidebar">
        <div className="side-marca marca">
          <span className="marca-icono" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="22" height="22">
              <path d="M4 20 C 9 8, 18 22, 28 6" fill="none" stroke="#94a3b8" strokeWidth="2.6" strokeLinecap="round" />
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
        </div>
      </aside>

      <main className="side-contenido">
        <div className="panel">
          <div className="panel-top">
            <span className="rol-etiqueta">Administrador</span>
            <h1 className="panel-titulo">{TITULOS[seccion]}</h1>
            <div className="panel-top-der">
              <MenuUsuario
                nombre={sesion.nombre}
                usuario={sesion.usuario}
                rol="Administrador"
                foto={sesion.foto}
                onCambiarFoto={cambiarFoto}
                onCambiarPassword={() => setModalPassword(true)}
                onCerrarSesion={logout}
              />
            </div>
          </div>

          {seccion === "paquetes" && (
            <PaquetesTab
              pedidos={pedidos}
              clientes={clientes}
              conductores={conductores}
              vehiculos={vehiculos}
              proveedores={proveedores}
              onCambio={cargar}
            />
          )}
          {seccion === "conductores" && <ConductoresTab conductores={conductores} onCambio={cargar} />}
          {seccion === "vehiculos" && <VehiculosTab vehiculos={vehiculos} onCambio={cargar} />}
          {seccion === "clientes" && <ClientesTab clientes={clientes} pedidos={pedidos} onCambio={cargar} />}
          {seccion === "auditoria" && <AuditoriaTab />}
        </div>
      </main>

      {modalPassword && <CambiarPasswordModal onCerrar={() => setModalPassword(false)} />}
    </div>
  );
}