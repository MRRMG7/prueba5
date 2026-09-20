from typing import List
from fastapi import Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from config.database import get_db
from config.security import get_password_hash
from models.database_models import ConductorModel, RolEnum, UsuarioModel
from models.schemas import ConductorBase, ConductorResponse

def get_conductores(db: Session = Depends(get_db)) -> List[ConductorResponse]:
    return db.query(ConductorModel).all()

def _generar_username(nombre: str) -> str:
    """primera letra del primer nombre + apellido, en minúsculas, sin tildes."""
    import re
    texto = nombre.lower().replace("ñ", "n").replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
    partes = re.split(r"\s+", texto.strip())
    if not partes:
        return "sin_nombre"
    if len(partes) == 1:
        return partes[0]
    return partes[0][0] + partes[-1]

def crear_conductor(conductor: ConductorBase, db: Session = Depends(get_db)) -> dict:
    if db.query(ConductorModel).filter(
        (ConductorModel.licencia == conductor.licencia) |
        ((ConductorModel.email != None) & (ConductorModel.email == conductor.email))
    ).first():
        raise HTTPException(status_code=400, detail="La licencia o el correo ya están registrados")

    base_username = _generar_username(conductor.nombre)
    username = base_username
    sufijo = 1
    while db.query(UsuarioModel).filter(UsuarioModel.username == username).first():
        sufijo += 1
        username = f"{base_username}{sufijo}"

    nuevo_conductor = ConductorModel(
        nombre=conductor.nombre,
        licencia=conductor.licencia,
        telefono=conductor.telefono,
        email=conductor.email,
    )
    db.add(nuevo_conductor)

    try:
        db.flush()

        nuevo_usuario = UsuarioModel(
            username=username,
            password_hash=get_password_hash("123"),
            rol=RolEnum.CONDUCTOR,
            id_ref=nuevo_conductor.id_conductor,
        )
        db.add(nuevo_usuario)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="No se pudo crear el conductor (dato duplicado)")

    db.refresh(nuevo_conductor)
    db.refresh(nuevo_usuario)
    return {
        "id_conductor": nuevo_conductor.id_conductor,
        "nombre": nuevo_conductor.nombre,
        "licencia": nuevo_conductor.licencia,
        "telefono": nuevo_conductor.telefono,
        "email": nuevo_conductor.email,
        "username": nuevo_usuario.username,
        "password_inicial": "123",
    }

def actualizar_conductor(id_conductor: int, cond_in: ConductorBase, db: Session = Depends(get_db)) -> ConductorResponse:
    cond = db.query(ConductorModel).filter(ConductorModel.id_conductor == id_conductor).first()
    if not cond:
        raise HTTPException(status_code=404, detail="Conductor no encontrado")
    for key, val in cond_in.dict().items():
        setattr(cond, key, val)
    db.commit()
    db.refresh(cond)
    return cond

def eliminar_conductor(id_conductor: int, db: Session = Depends(get_db)):
    cond = db.query(ConductorModel).filter(ConductorModel.id_conductor == id_conductor).first()
    if not cond:
        raise HTTPException(status_code=404, detail="Conductor no encontrado")
    db.delete(cond)
    db.commit()
