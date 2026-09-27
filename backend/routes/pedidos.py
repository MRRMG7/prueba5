import base64
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from config.database import get_db
from models.database_models import PedidoModel, ClienteModel, ConductorModel, VehiculoModel, RolEnum, EstadoPedidoEnum, UsuarioModel, HistorialPedidoModel
from models.schemas import PedidoCreate, PedidoUpdateState, PedidoResponse, HistorialResponse

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MIME_EXT = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}

def _guardar_foto(data_url: Optional[str]) -> Optional[str]:
    if not data_url:
        return None
    m = re.match(r"data:(image/(?:jpeg|png|webp|gif));base64,(.+)", data_url, re.DOTALL)
    if not m:
        return None
    mime, b64data = m.group(1), m.group(2)
    try:
        datos = base64.b64decode(b64data)
    except Exception:
        return None
    nombre = f"pedido_{uuid.uuid4().hex[:12]}.{MIME_EXT.get(mime, 'jpg')}"
    (UPLOAD_DIR / nombre).write_bytes(datos)
    return nombre

def _registrar_historial(
    db: Session,
    pedido_id: int,
    estado: EstadoPedidoEnum,
    nota: Optional[str] = None,
    foto: Optional[str] = None,
    firma: Optional[str] = None,
    usuario: Optional[str] = None,
) -> HistorialPedidoModel:
    registro = HistorialPedidoModel(
        id_pedido=pedido_id,
        estado=estado,
        nota=nota,
        foto=foto,
        firma=firma,
        usuario=usuario,
    )
    db.add(registro)
    return registro

def get_pedidos(db: Session = Depends(get_db)) -> List[PedidoResponse]:
    return db.query(PedidoModel).all()

def obtener_historial(id_pedido: int, db: Session = Depends(get_db)) -> List[HistorialResponse]:
    pedido = db.query(PedidoModel).filter(PedidoModel.id_pedido == id_pedido).first()
    if not pedido:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El pedido con ID {id_pedido} no existe",
        )
    return (
        db.query(HistorialPedidoModel)
        .filter(HistorialPedidoModel.id_pedido == id_pedido)
        .order_by(HistorialPedidoModel.id_historial.asc())
        .all()
    )

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
    db.flush()
    _registrar_historial(
        db,
        nuevo_pedido.id_pedido,
        estado_inicial,
        usuario=current_user.username if current_user else None,
    )
    db.commit()
    db.refresh(nuevo_pedido)
    return nuevo_pedido

def actualizar_pedido_completo(
    id_pedido: int,
    pedido_in: PedidoCreate,
    db: Session = Depends(get_db),
    current_user: Optional[UsuarioModel] = None
) -> PedidoResponse:
    pedido = db.query(PedidoModel).filter(PedidoModel.id_pedido == id_pedido).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    
    estado_antes = pedido.estado
    for field, value in pedido_in.dict(exclude_unset=True).items():
        setattr(pedido, field, value)
    
    if pedido.estado != estado_antes:
        _registrar_historial(
            db,
            pedido.id_pedido,
            pedido.estado,
            usuario=current_user.username if current_user else None,
        )
        if pedido.estado == EstadoPedidoEnum.INCIDENCIA:
            pedido.incidencia_nota = pedido.incidencia_nota or "Actualización desde el panel"
        elif estado_antes == EstadoPedidoEnum.INCIDENCIA:
            pedido.incidencia_nota = None

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

    nuevo_estado = estado_in.estado
    anterior = pedido.estado
    pedido.estado = nuevo_estado

    foto_nombre: Optional[str] = None
    if nuevo_estado == EstadoPedidoEnum.ENTREGADO:
        foto_nombre = _guardar_foto(estado_in.foto)
        if foto_nombre:
            pedido.foto_entrega = foto_nombre
        if estado_in.firma:
            pedido.firma_entrega = estado_in.firma
        pedido.entregado_at = datetime.utcnow()

    if nuevo_estado == EstadoPedidoEnum.INCIDENCIA:
        pedido.incidencia_nota = estado_in.nota
    elif anterior == EstadoPedidoEnum.INCIDENCIA:
        pedido.incidencia_nota = None

    _registrar_historial(
        db,
        pedido.id_pedido,
        nuevo_estado,
        nota=estado_in.nota,
        foto=foto_nombre,
        firma=estado_in.firma,
        usuario=current_user.username if current_user else None,
    )

    db.commit()
    db.refresh(pedido)
    return pedido

def eliminar_pedido(id_pedido: int, db: Session = Depends(get_db)):
    pedido = db.query(PedidoModel).filter(PedidoModel.id_pedido == id_pedido).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    db.delete(pedido)
    db.commit()
