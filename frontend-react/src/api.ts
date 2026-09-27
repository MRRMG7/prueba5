import type { Estado } from "./types";

export const API_URL = import.meta.env.VITE_API_URL || "http://192.168.1.22:8000";

export const CLAVE_SESION = "transporte:sesion:v1";

export const ESTADO_META: Record<
  Estado,
  { etiqueta: string; color: string; fondo: string }
> = {
  PENDIENTE: { etiqueta: "Pendiente", color: "#64748b", fondo: "#f1f5f9" },
  ASIGNADO: { etiqueta: "Asignado", color: "#334155", fondo: "#eef0f3" },
  RECOLECTADO: { etiqueta: "Recolectado", color: "#5b21b6", fondo: "rgba(124,58,237,.13)" },
  EN_CAMINO: { etiqueta: "En camino", color: "#9a6410", fondo: "rgba(245,166,35,.14)" },
  ENTREGADO: { etiqueta: "Entregado", color: "#0b8378", fondo: "rgba(46,196,182,.14)" },
  INCIDENCIA: { etiqueta: "Incidencia", color: "#c2410c", fondo: "rgba(243,108,44,.14)" },
  CANCELADO: { etiqueta: "Cancelado", color: "#c23333", fondo: "rgba(239,75,75,.12)" },
};

export async function api<T>(url: string, opciones: RequestInit = {}): Promise<T> {
  const token = leerToken();
  const res = await fetch(`${API_URL}${url}`, {
    ...opciones,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opciones.headers,
    },
    cache: "no-store",
  });
  if (res.status === 401) {
    try {
      localStorage.removeItem(CLAVE_SESION);
    } catch {
      /* localStorage no disponible */
    }
  }
  if (!res.ok) {
    let mensaje = `Error ${res.status}`;
    try {
      const data = await res.json();
      if (data && typeof data.detail === "string") mensaje = data.detail;
      else if (data && Array.isArray(data.detail) && data.detail.length) {
        mensaje = `Datos inválidos: ${data.detail[0].msg || "revisá los campos."}`;
      }
    } catch {
      /* cuerpo no JSON */
    }
    throw new Error(mensaje);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function nombreCliente(
  p: { id_cliente: number; cliente?: { nombre: string } | null },
  clientes: { id_cliente: number; nombre: string }[],
): string {
  if (p.cliente?.nombre) return p.cliente.nombre;
  const c = clientes.find((x) => x.id_cliente === p.id_cliente);
  return c ? c.nombre : `Cliente #${p.id_cliente}`;
}

export function nombreConductor(
  p: { id_conductor: number | null; conductor?: { nombre: string } | null },
  conductores: { id_conductor: number; nombre: string }[],
): string {
  if (p.conductor?.nombre) return p.conductor.nombre;
  const c = conductores.find((x) => x.id_conductor === p.id_conductor);
  return c ? c.nombre : p.id_conductor ? `Conductor #${p.id_conductor}` : "Sin asignar";
}

export function nombreProveedor(
  p: { id_proveedor: number | null; proveedor?: { nombre: string } | null },
  proveedores: { id_proveedor: number; nombre: string }[],
): string {
  if (p.proveedor?.nombre) return p.proveedor.nombre;
  const prov = proveedores.find((x) => x.id_proveedor === p.id_proveedor);
  return prov ? prov.nombre : "—";
}

export function urlArchivo(nombre?: string | null): string {
  if (!nombre) return "";
  if (/^data:/.test(nombre) || /^https?:\/\//.test(nombre)) return nombre;
  return `${API_URL}/uploads/${encodeURIComponent(nombre)}`;
}

export function formatearFecha(valor?: string | null): string {
  if (!valor) return "";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor;
  return fecha.toLocaleString("es-SV", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function leerToken(): string | null {
  try {
    const raw = localStorage.getItem(CLAVE_SESION);
    if (!raw) return null;
    const sesion = JSON.parse(raw) as { access_token?: string };
    return sesion?.access_token || null;
  } catch {
    return null;
  }
}