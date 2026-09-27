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
from models.database_models import ClienteModel, RolEnum, UsuarioModel
from models.schemas import LoginRequest, RegistroCliente, Token

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
