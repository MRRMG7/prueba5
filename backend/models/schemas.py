from typing import List, Optional
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

class PedidoCreate(BaseModel):
    id_cliente: int
    direccion: str
    latitud: float
    longitud: float
    id_conductor: Optional[int] = None
    id_vehiculo: Optional[int] = None
    estado: Optional[EstadoPedidoEnum] = EstadoPedidoEnum.PENDIENTE

class PedidoUpdateState(BaseModel):
    estado: EstadoPedidoEnum

class PedidoResponse(BaseModel):
    id_pedido: int
    id_cliente: int
    id_conductor: Optional[int] = None
    id_vehiculo: Optional[int] = None
    direccion: str
    latitud: float
    longitud: float
    estado: EstadoPedidoEnum
    cliente: Optional[ClienteResponse] = None
    conductor: Optional[ConductorResponse] = None
    vehiculo: Optional[VehiculoResponse] = None

    class Config:
        from_attributes = True
