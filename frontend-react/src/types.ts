export type Rol = "ADMIN" | "CONDUCTOR" | "CLIENTE";

export interface Sesion {
  id_usuario: number;
  usuario: string;
  nombre: string;
  rol: Rol;
  id_ref: number | null;
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
  cliente?: { nombre: string } | null;
  conductor?: { nombre: string } | null;
  vehiculo?: { placa: string; tipo: string } | null;
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