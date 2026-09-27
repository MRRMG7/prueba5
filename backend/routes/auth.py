from typing import Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from config.database import get_db
from config.security import (
    verify_password,
    create_access_token,
    get_password_hash,
    SECRET_KEY,
    ALGORITHM,
    oauth2_scheme,
)
from models.database_models import ClienteModel, ConductorModel, RolEnum, UsuarioModel, ProveedorModel
from models.schemas import LoginRequest, RegistroCliente, RegistroConductor, RegistroProveedor, CambiarPassword, Token

def get_current_user_optional(token: Optional[str], db: Session) -> Optional[UsuarioModel]:
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        return db.query(UsuarioModel).filter(UsuarioModel.username == username).first()
    except JWTError:
        return None

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> UsuarioModel:
    cred_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No autenticado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise cred_error
    except JWTError:
        raise cred_error
    user = db.query(UsuarioModel).filter(UsuarioModel.username == username).first()
    if not user:
        raise cred_error
    return user

def registrar_cliente(registro: RegistroCliente, db: Session = Depends(get_db)):
    if db.query(UsuarioModel).filter(UsuarioModel.username == registro.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El nombre de usuario ya está registrado",
        )

    if db.query(ClienteModel).filter(ClienteModel.email == registro.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo ya está registrado",
        )

    nuevo_cliente = ClienteModel(
        nombre=registro.nombre,
        telefono=registro.telefono,
        email=registro.email,
        direccion=registro.direccion,
    )
    db.add(nuevo_cliente)

    try:
        db.flush()

        nuevo_usuario = UsuarioModel(
            username=registro.username,
            password_hash=get_password_hash(registro.password),
            rol=RolEnum.CLIENTE,
            id_ref=nuevo_cliente.id_cliente,
        )
        db.add(nuevo_usuario)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El nombre de usuario o el correo ya están registrados",
        )

    db.refresh(nuevo_usuario)
    return {
        "id_usuario": nuevo_usuario.id_usuario,
        "id_cliente": nuevo_cliente.id_cliente,
        "username": nuevo_usuario.username,
        "email": nuevo_cliente.email,
        "rol": nuevo_usuario.rol.value,
    }

def registrar_conductor(registro: RegistroConductor, db: Session = Depends(get_db)):
    if db.query(UsuarioModel).filter(UsuarioModel.username == registro.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El nombre de usuario ya está en uso",
        )

    duplicado = db.query(ConductorModel).filter(
        (ConductorModel.licencia == registro.licencia) |
        ((ConductorModel.email != None) & (registro.email is not None) & (ConductorModel.email == registro.email))
    ).first()
    if duplicado:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La licencia o el correo ya están registrados",
        )

    nuevo_conductor = ConductorModel(
        nombre=registro.nombre,
        licencia=registro.licencia,
        telefono=registro.telefono,
        email=registro.email,
    )
    db.add(nuevo_conductor)

    try:
        db.flush()

        nuevo_usuario = UsuarioModel(
            username=registro.username,
            password_hash=get_password_hash(registro.password),
            rol=RolEnum.CONDUCTOR,
            id_ref=nuevo_conductor.id_conductor,
        )
        db.add(nuevo_usuario)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario, la licencia o el correo ya están registrados",
        )

    db.refresh(nuevo_usuario)
    return {
        "id_usuario": nuevo_usuario.id_usuario,
        "id_conductor": nuevo_conductor.id_conductor,
        "username": nuevo_usuario.username,
        "nombre": nuevo_conductor.nombre,
        "rol": nuevo_usuario.rol.value,
    }

def registrar_proveedor(registro: RegistroProveedor, db: Session = Depends(get_db)):
    if db.query(UsuarioModel).filter(UsuarioModel.username == registro.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El nombre de usuario ya está en uso",
        )

    if db.query(ProveedorModel).filter(ProveedorModel.email == registro.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo ya está registrado",
        )

    nuevo_proveedor = ProveedorModel(
        nombre=registro.nombre,
        telefono=registro.telefono,
        email=registro.email,
        direccion=registro.direccion,
    )
    db.add(nuevo_proveedor)

    try:
        db.flush()

        nuevo_usuario = UsuarioModel(
            username=registro.username,
            password_hash=get_password_hash(registro.password),
            rol=RolEnum.PROVEEDOR,
            id_ref=nuevo_proveedor.id_proveedor,
        )
        db.add(nuevo_usuario)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario o el correo ya están registrados",
        )

    db.refresh(nuevo_proveedor)
    db.refresh(nuevo_usuario)
    return {
        "id_usuario": nuevo_usuario.id_usuario,
        "id_proveedor": nuevo_proveedor.id_proveedor,
        "username": nuevo_usuario.username,
        "nombre": nuevo_proveedor.nombre,
        "rol": nuevo_usuario.rol.value,
    }

def cambiar_password(
    body: CambiarPassword,
    db: Session = Depends(get_db),
    current_user: Optional[UsuarioModel] = None,
):
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado",
        )
    if not verify_password(body.password_actual, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña actual es incorrecta",
        )
    if len(body.password_nueva) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La nueva contraseña debe tener al menos 4 caracteres",
        )
    current_user.password_hash = get_password_hash(body.password_nueva)
    db.commit()
    return {"ok": True, "mensaje": "Contraseña actualizada"}
