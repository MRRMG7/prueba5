export type Rol = "ADMIN" | "CONDUCTOR" | "CLIENTE";

export interface Sesion {
  id_usuario: number;
  usuario: string;
  nombre: string;
  rol: Rol;
  id_ref: number | null;
  foto?: string | null;
  access_token?: string;
}

export interface Cliente {
  id_cliente: number;
  nombre: string;
  telefono: string;
  email: string;
  direccion: string;
}

export interface Conductor {
  id_conductor: number;
  nombre: string;
  licencia: string;
  telefono: string;
  email?: string | null;
  username?: string;
  id_usuario?: number;
}

export interface Vehiculo {
  id_vehiculo: number;
  placa: string;
  tipo: string;
  capacidad: string;
}

export type Estado =
  | "PENDIENTE"
  | "ASIGNADO"
  | "EN_CAMINO"
  | "ENTREGADO"
  | "INCIDENCIA"
  | "CANCELADO";

export interface Pedido {
  id_pedido: number;
  id_cliente: number;
  id_conductor: number | null;
  id_vehiculo: number | null;
  direccion: string;
  latitud: number;
  longitud: number;
  estado: Estado;
  incidencia_nota?: string | null;
  foto_entrega?: string | null;
  firma_entrega?: string | null;
  entregado_at?: string | null;
  created_at?: string | null;
  cliente?: { nombre: string } | null;
  conductor?: { nombre: string } | null;
  vehiculo?: { placa: string; tipo: string } | null;
}

export interface Auditoria {
  id_auditoria: number;
  usuario: string;
  accion: string;
  detalle?: string | null;
  fecha?: string | null;
}

export interface HistorialEntrega {
  id_historial: number;
  id_pedido: number;
  estado: Estado;
  fecha?: string | null;
  nota?: string | null;
  foto?: string | null;
  firma?: string | null;
  usuario?: string | null;
}

export interface CuerpoPedido {
  id_cliente: number;
  direccion: string;
  latitud: number;
  longitud: number;
  id_conductor: number | null;
  id_vehiculo: number | null;
  estado: Estado;
}

export interface ConductorCreado extends Conductor {
  username: string;
  password_inicial: string;
}

export interface ErrorDetalle {
  detail?: string | { msg?: string }[];
}