from typing import List, Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from config.database import get_db
from models.database_models import PedidoModel, ClienteModel, ConductorModel, VehiculoModel, RolEnum, EstadoPedidoEnum, UsuarioModel
from models.schemas import PedidoCreate, PedidoUpdateState, PedidoResponse

def get_pedidos(db: Session = Depends(get_db)) -> List[PedidoResponse]:
    return db.query(PedidoModel).all()

def listar_pedidos_filtrados(
    db: Session = Depends(get_db), 
    current_user: Optional[UsuarioModel] = None
) -> List[PedidoResponse]:
    if current_user:
        if current_user.rol == RolEnum.CONDUCTOR:
            return db.query(PedidoModel).filter(PedidoModel.id_conductor == current_user.id_ref).all()
        elif current_user.rol == RolEnum.CLIENTE:
            return db.query(PedidoModel).filter(PedidoModel.id_cliente == current_user.id_ref).all()
    return db.query(PedidoModel).all()

def crear_pedido(
    pedido_in: PedidoCreate,
    db: Session = Depends(get_db),
    current_user: Optional[UsuarioModel] = None
) -> PedidoResponse:
    
    if current_user and current_user.rol == RolEnum.CLIENTE and pedido_in.id_cliente != current_user.id_ref:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para crear pedidos a nombre de otro cliente",
        )

    cliente = db.query(ClienteModel).filter(ClienteModel.id_cliente == pedido_in.id_cliente).first()
    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El cliente con ID {pedido_in.id_cliente} no existe",
        )

    if pedido_in.id_conductor:
        conductor = db.query(ConductorModel).filter(ConductorModel.id_conductor == pedido_in.id_conductor).first()
        if not conductor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El conductor con ID {pedido_in.id_conductor} no existe",
            )

    if pedido_in.id_vehiculo:
        vehiculo = db.query(VehiculoModel).filter(VehiculoModel.id_vehiculo == pedido_in.id_vehiculo).first()
        if not vehiculo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El vehículo con ID {pedido_in.id_vehiculo} no existe",
            )

    estado_inicial = pedido_in.estado if pedido_in.estado else (
        EstadoPedidoEnum.ASIGNADO
        if pedido_in.id_conductor and pedido_in.id_vehiculo
        else EstadoPedidoEnum.PENDIENTE
    )

    nuevo_pedido = PedidoModel(
        id_cliente=pedido_in.id_cliente,
        id_conductor=pedido_in.id_conductor,
        id_vehiculo=pedido_in.id_vehiculo,
        direccion=pedido_in.direccion,
        latitud=pedido_in.latitud,
        longitud=pedido_in.longitud,
        estado=estado_inicial,
    )

    db.add(nuevo_pedido)
    db.commit()
    db.refresh(nuevo_pedido)
    return nuevo_pedido

def actualizar_pedido_completo(
    id_pedido: int,
    pedido_in: PedidoCreate,
    db: Session = Depends(get_db)
) -> PedidoResponse:
    pedido = db.query(PedidoModel).filter(PedidoModel.id_pedido == id_pedido).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    
    for field, value in pedido_in.dict(exclude_unset=True).items():
        setattr(pedido, field, value)
        
    db.commit()
    db.refresh(pedido)
    return pedido

def actualizar_estado_pedido(
    id_pedido: int,
    estado_in: PedidoUpdateState,
    db: Session = Depends(get_db),
    current_user: Optional[UsuarioModel] = None
) -> PedidoResponse:
    pedido = db.query(PedidoModel).filter(PedidoModel.id_pedido == id_pedido).first()
    
    if not pedido:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El pedido con ID {id_pedido} no existe",
        )

    if current_user and current_user.rol == RolEnum.CONDUCTOR and pedido.id_conductor != current_user.id_ref:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para modificar un pedido asignado a otro conductor",
        )

    pedido.estado = estado_in.estado
    db.commit()
    db.refresh(pedido)
    return pedido

def eliminar_pedido(id_pedido: int, db: Session = Depends(get_db)):
    pedido = db.query(PedidoModel).filter(PedidoModel.id_pedido == id_pedido).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    db.delete(pedido)
    db.commit()
