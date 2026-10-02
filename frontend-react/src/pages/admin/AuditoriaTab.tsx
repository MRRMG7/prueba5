import { useEffect, useState } from "react";
import { api, formatearFecha } from "../../api";
import type { Auditoria } from "../../types";

const ACCION_META: Record<string, { etiqueta: string; color: string }> = {
  LOGIN: { etiqueta: "Inicio de sesión", color: "#334155" },
  CLIENTE_CREAR: { etiqueta: "Cliente creado", color: "#64748b" },
  CLIENTE_EDITAR: { etiqueta: "Cliente editado", color: "#64748b" },
  CLIENTE_ELIMINAR: { etiqueta: "Cliente eliminado", color: "#c23333" },
  CLIENTE_AUTOREGISTRO: { etiqueta: "Cliente autoregistrado", color: "#64748b" },
  CONDUCTOR_CREAR: { etiqueta: "Conductor creado", color: "#64748b" },
  CONDUCTOR_EDITAR: { etiqueta: "Conductor editado", color: "#64748b" },
  CONDUCTOR_ELIMINAR: { etiqueta: "Conductor eliminado", color: "#c23333" },
  CONDUCTOR_ALTAREGISTRO: { etiqueta: "Conductor autoregistrado", color: "#64748b" },
  PROVEEDOR_CREAR: { etiqueta: "Proveedor creado", color: "#64748b" },
  PROVEEDOR_EDITAR: { etiqueta: "Proveedor editado", color: "#64748b" },
  PROVEEDOR_ELIMINAR: { etiqueta: "Proveedor eliminado", color: "#c23333" },
  PROVEEDOR_ALTAREGISTRO: { etiqueta: "Proveedor autoregistrado", color: "#64748b" },
  VEHICULO_CREAR: { etiqueta: "Vehículo creado", color: "#64748b" },
  VEHICULO_EDITAR: { etiqueta: "Vehículo editado", color: "#64748b" },
  VEHICULO_ELIMINAR: { etiqueta: "Vehículo eliminado", color: "#c23333" },
  PEDIDO_CREAR: { etiqueta: "Pedido creado", color: "#64748b" },
  PEDIDO_EDITAR: { etiqueta: "Pedido editado", color: "#64748b" },
  PEDIDO_ELIMINAR: { etiqueta: "Pedido eliminado", color: "#c23333" },
  PEDIDO_ESTADO: { etiqueta: "Estado de pedido", color: "#f5a623" },
  CONTRASENA_CAMBIAR: { etiqueta: "Cambio de contraseña", color: "#8b5cf6" },
  PERFIL_FOTO: { etiqueta: "Foto de perfil", color: "#3b82f6" },
};

export default function AuditoriaTab() {
  const [registros, setRegistros] = useState<Auditoria[] | null>(null);
  const [filtro, setFiltro] = useState("");
  const [error, setError] = useState("");

  async function cargar() {
    try {
      const data = await api<Auditoria[]>("/auditoria");
      setRegistros(data || []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la auditoría");
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const visibles = (registros || []).filter((r) => {
    const q = filtro.trim().toLowerCase();
    if (!q) return true;
    return `${r.usuario} ${r.accion} ${r.detalle || ""}`.toLowerCase().includes(q);
  });

  return (
    <section className="tarjeta">
      <div className="cabecera-tarjeta">
        <h2>Auditoría</h2>
        <p>Registro de quién hizo qué y cuándo en el sistema.</p>
      </div>
      <div className="cuerpo-tarjeta">
        <input
          className="campo-auditoria"
          type="search"
          placeholder="Filtrar por usuario, acción o detalle…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />

        {error && <p className="error-login">{error}</p>}

        {!error && registros === null && <p className="celda-suave">Cargando auditoría…</p>}
        {!error && registros !== null && visibles.length === 0 && (
          <p className="celda-suave" style={{ textAlign: "center", padding: "28px 12px" }}>
            Sin movimientos registrados{filtro ? " que coincidan con tu búsqueda" : ""}.
          </p>
        )}

        {visibles.length > 0 && (
          <div className="overflow">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((r) => {
                  const meta = ACCION_META[r.accion] || { etiqueta: r.accion, color: "#64748b" };
                  return (
                    <tr key={r.id_auditoria}>
                      <td className="celda-suave">{formatearFecha(r.fecha)}</td>
                      <td className="celda-fuerte">@{r.usuario}</td>
                      <td>
                        <span
                          className="pill-accion"
                          style={{ background: `${meta.color}1a`, color: meta.color }}
                        >
                          {meta.etiqueta}
                        </span>
                      </td>
                      <td className="celda-suave">{r.detalle || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}