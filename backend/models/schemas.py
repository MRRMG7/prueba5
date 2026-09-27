from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from .database_models import EstadoPedidoEnum

class LoginRequest(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    rol: str
    username: str

class ClienteBase(BaseModel):
    nombre: str
    telefono: str
    email: str
    direccion: str

class ClienteResponse(ClienteBase):
    id_cliente: int

    class Config:
        from_attributes = True

class RegistroCliente(BaseModel):
    nombre: str
    telefono: str
    email: str
    direccion: str
    username: str
    password: str

class RegistroProveedor(BaseModel):
    nombre: str
    telefono: str
    email: str
    direccion: Optional[str] = None
    username: str
    password: str

class RegistroConductor(BaseModel):
    nombre: str
    licencia: str
    telefono: str
    email: Optional[str] = None
    username: str
    password: str

class CambiarPassword(BaseModel):
    password_actual: str
    password_nueva: str

class FotoPerfil(BaseModel):
    foto: Optional[str] = None

class ConductorBase(BaseModel):
    nombre: str
    licencia: str
    telefono: str
    email: Optional[str] = None

class ConductorResponse(ConductorBase):
    id_conductor: int

    class Config:
        from_attributes = True

class VehiculoBase(BaseModel):
    placa: str
    tipo: str
    capacidad: str

class VehiculoResponse(VehiculoBase):
    id_vehiculo: int

    class Config:
        from_attributes = True

class ProveedorBase(BaseModel):
    nombre: str
    telefono: str
    email: str
    direccion: Optional[str] = None

class ProveedorResponse(ProveedorBase):
    id_proveedor: int

    class Config:
        from_attributes = True

class PedidoCreate(BaseModel):
    id_cliente: int
    direccion: str
    latitud: float
    longitud: float
    id_conductor: Optional[int] = None
    id_vehiculo: Optional[int] = None
    id_proveedor: Optional[int] = None
    estado: Optional[EstadoPedidoEnum] = EstadoPedidoEnum.PENDIENTE

class PedidoUpdateState(BaseModel):
    estado: EstadoPedidoEnum
    nota: Optional[str] = None
    foto: Optional[str] = None
    firma: Optional[str] = None

class PedidoResponse(BaseModel):
    id_pedido: int
    id_cliente: int
    id_conductor: Optional[int] = None
    id_vehiculo: Optional[int] = None
    id_proveedor: Optional[int] = None
    direccion: str
    latitud: float
    longitud: float
    estado: EstadoPedidoEnum
    incidencia_nota: Optional[str] = None
    foto_entrega: Optional[str] = None
    firma_entrega: Optional[str] = None
    entregado_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    cliente: Optional[ClienteResponse] = None
    conductor: Optional[ConductorResponse] = None
    vehiculo: Optional[VehiculoResponse] = None
    proveedor: Optional[ProveedorResponse] = None
    historial: Optional[List["HistorialResponse"]] = None

    class Config:
        from_attributes = True

class HistorialResponse(BaseModel):
    id_historial: int
    id_pedido: int
    estado: EstadoPedidoEnum
    fecha: Optional[datetime] = None
    nota: Optional[str] = None
    foto: Optional[str] = None
    firma: Optional[str] = None
    usuario: Optional[str] = None

    class Config:
        from_attributes = True

class AuditoriaResponse(BaseModel):
    id_auditoria: int
    usuario: str
    accion: str
    detalle: Optional[str] = None
    fecha: Optional[datetime] = None

    class Config:
        from_attributes = True

PedidoResponse.model_rebuild()
