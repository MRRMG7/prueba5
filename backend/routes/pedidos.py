import base64
import random
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from uuid import uuid4
from fastapi import Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from config.database import get_db
from models.database_models import PedidoModel, ClienteModel, ConductorModel, VehiculoModel, RolEnum, EstadoPedidoEnum, UsuarioModel, HistorialPedidoModel, ProveedorModel
from models.schemas import PedidoCreate, PedidoUpdateState, PedidoResponse, HistorialResponse, AprobarPedido, RecolectarPedido

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
        elif current_user.rol == RolEnum.PROVEEDOR:
            return db.query(PedidoModel).filter(PedidoModel.id_proveedor == current_user.id_ref).all()
    return db.query(PedidoModel).all()

def _resolver_cliente(pedido_in: PedidoCreate, db: Session) -> ClienteModel:
    """Si viene id_cliente se usa ese; si viene la ficha escrita, la busca o la crea."""
    if pedido_in.id_cliente:
        cliente = db.query(ClienteModel).filter(ClienteModel.id_cliente == pedido_in.id_cliente).first()
        if not cliente:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El cliente con ID {pedido_in.id_cliente} no existe",
            )
        return cliente

    datos = pedido_in.cliente
    if not datos or not datos.nombre.strip() or not datos.telefono.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Escribí los datos del cliente: nombre y teléfono son obligatorios",
        )

    email = (datos.email or "").strip().lower()
    nombre = datos.nombre.strip()
    telefono = datos.telefono.strip()

    cliente = None
    if email:
        cliente = db.query(ClienteModel).filter(func.lower(ClienteModel.email) == email).first()
    if not cliente:
        cliente = (
            db.query(ClienteModel)
            .filter(func.lower(ClienteModel.nombre) == nombre.lower(), ClienteModel.telefono == telefono)
            .first()
        )
    if cliente:
        return cliente

    direccion = (datos.direccion or "").strip() or pedido_in.direccion
    nuevo = ClienteModel(
        nombre=nombre,
        telefono=telefono,
        email=email or f"sin-correo-{uuid4().hex[:10]}@local",
        direccion=direccion,
    )
    db.add(nuevo)
    db.flush()
    return nuevo

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

    cliente = _resolver_cliente(pedido_in, db)

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

    es_proveedor = current_user and current_user.rol == RolEnum.PROVEEDOR
    nuevo_pedido = PedidoModel(
        id_cliente=cliente.id_cliente,
        id_conductor=None if es_proveedor else pedido_in.id_conductor,
        id_vehiculo=None if es_proveedor else pedido_in.id_vehiculo,
        id_proveedor=pedido_in.id_proveedor
        if pedido_in.id_proveedor is not None
        else (current_user.id_ref if es_proveedor else None),
        direccion=pedido_in.direccion,
        latitud=pedido_in.latitud,
        longitud=pedido_in.longitud,
        estado=EstadoPedidoEnum.PENDIENTE if es_proveedor else estado_inicial,
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

    # Esta edicion completa es solo del admin (reasignar conductor/vehiculo).
    # Asi nadie puede usar este atajo para saltarse la recolecta o la entrega.
    if not current_user or current_user.rol != RolEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el administrador puede editar un pedido completo",
        )

    if pedido_in.estado == EstadoPedidoEnum.ENTREGADO and pedido.estado != EstadoPedidoEnum.RECOLECTADO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se puede marcar como entregado un paquete ya recolectado",
        )

    estado_antes = pedido.estado
    for field, value in pedido_in.dict(exclude_unset=True, exclude={"cliente"}).items():
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

    if current_user and current_user.rol == RolEnum.CONDUCTOR:
        permitidos = {
            EstadoPedidoEnum.INCIDENCIA,
            EstadoPedidoEnum.ENTREGADO,
        }
        if estado_in.estado not in permitidos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo podés registrar la entrega o una incidencia desde tu panel",
            )
        if pedido.estado in (EstadoPedidoEnum.PENDIENTE, EstadoPedidoEnum.ASIGNADO):
            if estado_in.estado != EstadoPedidoEnum.INCIDENCIA:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El paquete tiene que estar recolectado para poder entregarlo",
                )
        if estado_in.estado == EstadoPedidoEnum.ENTREGADO and pedido.estado != EstadoPedidoEnum.RECOLECTADO:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Solo se puede marcar como entregado un paquete ya recolectado",
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

def _generar_codigo_recolecta(db: Session) -> str:
    while True:
        codigo = f"R-{random.randint(1000, 9999)}"
        existe = db.query(PedidoModel).filter(PedidoModel.codigo_recolecta == codigo).first()
        if not existe:
            return codigo

def aprobar_pedido(
    id_pedido: int,
    aprobar_in: AprobarPedido,
    db: Session = Depends(get_db),
    current_user: Optional[UsuarioModel] = None,
) -> PedidoResponse:
    if not current_user or current_user.rol != RolEnum.ADMIN:
        raise HTTPException(status_code=403, detail="Solo el administrador puede aprobar pedidos")

    pedido = db.query(PedidoModel).filter(PedidoModel.id_pedido == id_pedido).first()
    if not pedido:
        raise HTTPException(status_code=404, detail=f"El pedido con ID {id_pedido} no existe")
    if pedido.estado != EstadoPedidoEnum.PENDIENTE:
        raise HTTPException(status_code=400, detail="Solo se pueden aprobar pedidos en estado PENDIENTE")

    conductor = db.query(ConductorModel).filter(ConductorModel.id_conductor == aprobar_in.id_conductor).first()
    if not conductor:
        raise HTTPException(status_code=404, detail="El conductor no existe")
    if aprobar_in.id_vehiculo:
        vehiculo = db.query(VehiculoModel).filter(VehiculoModel.id_vehiculo == aprobar_in.id_vehiculo).first()
        if not vehiculo:
            raise HTTPException(status_code=404, detail="El vehículo no existe")

    pedido.id_conductor = aprobar_in.id_conductor
    pedido.id_vehiculo = aprobar_in.id_vehiculo
    pedido.codigo_recolecta = _generar_codigo_recolecta(db)
    pedido.estado = EstadoPedidoEnum.ASIGNADO

    _registrar_historial(
        db,
        pedido.id_pedido,
        EstadoPedidoEnum.ASIGNADO,
        nota=f"Aprobado y asignado al conductor {conductor.nombre} · Código de recolecta {pedido.codigo_recolecta}",
        usuario=current_user.username,
    )
    db.commit()
    db.refresh(pedido)
    return pedido

def recolectar_pedido(
    id_pedido: int,
    recolectar_in: RecolectarPedido,
    db: Session = Depends(get_db),
    current_user: Optional[UsuarioModel] = None,
) -> PedidoResponse:
    pedido = db.query(PedidoModel).filter(PedidoModel.id_pedido == id_pedido).first()
    if not pedido:
        raise HTTPException(status_code=404, detail=f"El pedido con ID {id_pedido} no existe")

    if not current_user or current_user.rol != RolEnum.CONDUCTOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el conductor asignado puede registrar la recolección",
        )

    if pedido.id_conductor != current_user.id_ref:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para recolectar un pedido asignado a otro conductor",
        )

    if pedido.estado != EstadoPedidoEnum.ASIGNADO:
        raise HTTPException(status_code=400, detail="El pedido no está asignado para recolecta")

    codigo_ingresado = (recolectar_in.codigo or "").strip()
    if not pedido.codigo_recolecta or codigo_ingresado.upper() != pedido.codigo_recolecta.upper():
        raise HTTPException(status_code=400, detail="El código de recolecta es incorrecto")

    pedido.estado = EstadoPedidoEnum.RECOLECTADO
    _registrar_historial(
        db,
        pedido.id_pedido,
        EstadoPedidoEnum.RECOLECTADO,
        nota=f"Recolección confirmada con código {pedido.codigo_recolecta}",
        usuario=current_user.username if current_user else None,
    )
    db.commit()
    db.refresh(pedido)
    return pedido

def reanudar_pedido(
    id_pedido: int,
    db: Session = Depends(get_db),
    current_user: Optional[UsuarioModel] = None,
) -> PedidoResponse:
    """Saca un pedido de una incidencia y lo devuelve al estado que le corresponde.

    Si el paquete ya se habia recolectado, vuelve a RECOLECTADO y el conductor
    puede entregarlo. Si la incidencia fue porque no se pudo recolectar, vuelve
    a ASIGNADO para que tenga que validar el codigo otra vez: nunca se entrega
    un paquete que no se haya recolectado con su codigo.
    """
    pedido = db.query(PedidoModel).filter(PedidoModel.id_pedido == id_pedido).first()
    if not pedido:
        raise HTTPException(status_code=404, detail=f"El pedido con ID {id_pedido} no existe")

    if not current_user or current_user.rol != RolEnum.CONDUCTOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el conductor asignado puede reanudar una entrega",
        )

    if pedido.id_conductor != current_user.id_ref:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para reanudar un pedido asignado a otro conductor",
        )

    if pedido.estado != EstadoPedidoEnum.INCIDENCIA:
        raise HTTPException(
            status_code=400,
            detail="Solo se pueden reanudar pedidos con incidencia",
        )

    ya_recolectado = (
        db.query(HistorialPedidoModel)
        .filter(
            HistorialPedidoModel.id_pedido == id_pedido,
            HistorialPedidoModel.estado == EstadoPedidoEnum.RECOLECTADO,
        )
        .first()
    )
    destino = (
        EstadoPedidoEnum.RECOLECTADO if ya_recolectado else EstadoPedidoEnum.ASIGNADO
    )

    pedido.estado = destino
    pedido.incidencia_nota = None
    _registrar_historial(
        db,
        pedido.id_pedido,
        destino,
        nota=(
            "Incidencia resuelta, el paquete vuelve a estar listo para entregar"
            if destino == EstadoPedidoEnum.RECOLECTADO
            else "Incidencia resuelta, vuelve a la lista de recolecta"
        ),
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
