from typing import List
from fastapi import Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from config.database import get_db
from config.security import get_password_hash
from models.database_models import ProveedorModel, RolEnum, UsuarioModel
from models.schemas import ProveedorBase, ProveedorResponse

PASSWORD_INICIAL = "123"


def get_proveedores(db: Session = Depends(get_db)) -> List[ProveedorResponse]:
    return db.query(ProveedorModel).all()


def _generar_username(nombre: str) -> str:
    """primera letra del primer nombre + apellido, en minusculas, sin tildes."""
    import re
    texto = (
        nombre.lower()
        .replace("á", "n").replace("ä", "a").replace("é", "e")
        .replace("í", "i").replace("ó", "o").replace("ú", "u")
    )
    partes = re.split(r"\s+", texto.strip())
    if not partes:
        return "sin_nombre"
    if len(partes) == 1:
        return partes[0]
    return partes[0][0] + partes[-1]


def crear_proveedor(proveedor: ProveedorBase, db: Session = Depends(get_db)) -> dict:
    if db.query(ProveedorModel).filter(ProveedorModel.email == proveedor.email).first():
        raise HTTPException(status_code=400, detail="El correo ya está registrado")

    base_username = _generar_username(proveedor.nombre)
    username = base_username
    sufijo = 1
    while db.query(UsuarioModel).filter(UsuarioModel.username == username).first():
        sufijo += 1
        username = f"{base_username}{sufijo}"

    nuevo = ProveedorModel(
        nombre=proveedor.nombre,
        telefono=proveedor.telefono,
        email=proveedor.email,
        direccion=proveedor.direccion,
    )
    db.add(nuevo)

    try:
        db.flush()

        nuevo_usuario = UsuarioModel(
            username=username,
            password_hash=get_password_hash(PASSWORD_INICIAL),
            rol=RolEnum.PROVEEDOR,
            id_ref=nuevo.id_proveedor,
        )
        db.add(nuevo_usuario)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="No se pudo crear el negocio (dato duplicado)")

    db.refresh(nuevo)
    db.refresh(nuevo_usuario)
    return {
        "id_proveedor": nuevo.id_proveedor,
        "nombre": nuevo.nombre,
        "telefono": nuevo.telefono,
        "email": nuevo.email,
        "direccion": nuevo.direccion,
        "username": nuevo_usuario.username,
        "password_inicial": PASSWORD_INICIAL,
    }


def actualizar_proveedor(
    id_proveedor: int, proveedor_in: ProveedorBase, db: Session = Depends(get_db)
) -> ProveedorResponse:
    prov = db.query(ProveedorModel).filter(ProveedorModel.id_proveedor == id_proveedor).first()
    if not prov:
        raise HTTPException(status_code=404, detail="Negocio no encontrado")
    for key, val in proveedor_in.dict().items():
        setattr(prov, key, val)
    db.commit()
    db.refresh(prov)
    return prov


def eliminar_proveedor(id_proveedor: int, db: Session = Depends(get_db)):
    prov = db.query(ProveedorModel).filter(ProveedorModel.id_proveedor == id_proveedor).first()
    if not prov:
        raise HTTPException(status_code=404, detail="Negocio no encontrado")
    db.query(UsuarioModel).filter(
        UsuarioModel.rol == RolEnum.PROVEEDOR,
        UsuarioModel.id_ref == id_proveedor,
    ).delete()
    db.delete(prov)
    db.commit()