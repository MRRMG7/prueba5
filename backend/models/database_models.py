import enum
from sqlalchemy import Column, DateTime, Enum as SQLEnum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()

class RolEnum(str, enum.Enum):
    ADMIN = "ADMIN"
    CONDUCTOR = "CONDUCTOR"
    CLIENTE = "CLIENTE"

class EstadoPedidoEnum(str, enum.Enum):
    PENDIENTE = "PENDIENTE"
    ASIGNADO = "ASIGNADO"
    EN_CAMINO = "EN_CAMINO"
    ENTREGADO = "ENTREGADO"
    INCIDENCIA = "INCIDENCIA"
    CANCELADO = "CANCELADO"

class UsuarioModel(Base):
    __tablename__ = "usuarios"

    id_usuario = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    rol = Column(SQLEnum(RolEnum), nullable=False)
    id_ref = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class ClienteModel(Base):
    __tablename__ = "clientes"

    id_cliente = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    telefono = Column(String(20), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    direccion = Column(Text, nullable=False)

    pedidos = relationship("PedidoModel", back_populates="cliente")

class ConductorModel(Base):
    __tablename__ = "conductores"

    id_conductor = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    licencia = Column(String(50), unique=True, nullable=False)
    telefono = Column(String(20), nullable=False)
    email = Column(String(100), nullable=True)

    pedidos = relationship("PedidoModel", back_populates="conductor")

class VehiculoModel(Base):
    __tablename__ = "vehiculos"

    id_vehiculo = Column(Integer, primary_key=True, index=True)
    placa = Column(String(20), unique=True, nullable=False)
    tipo = Column(String(50), nullable=False)
    capacidad = Column(String(50), nullable=False)

    pedidos = relationship("PedidoModel", back_populates="vehiculo")

class PedidoModel(Base):
    __tablename__ = "pedidos"

    id_pedido = Column(Integer, primary_key=True, index=True)
    id_cliente = Column(Integer, ForeignKey("clientes.id_cliente", ondelete="RESTRICT"), nullable=False)
    id_conductor = Column(Integer, ForeignKey("conductores.id_conductor", ondelete="SET NULL"), nullable=True)
    id_vehiculo = Column(Integer, ForeignKey("vehiculos.id_vehiculo", ondelete="SET NULL"), nullable=True)
    direccion = Column(Text, nullable=False)
    latitud = Column(Numeric(10, 8), nullable=False)
    longitud = Column(Numeric(11, 8), nullable=False)
    estado = Column(SQLEnum(EstadoPedidoEnum), default=EstadoPedidoEnum.PENDIENTE)
    created_at = Column(DateTime, server_default=func.now())

    cliente = relationship("ClienteModel", back_populates="pedidos")
    conductor = relationship("ConductorModel", back_populates="pedidos")
    vehiculo = relationship("VehiculoModel", back_populates="pedidos")
