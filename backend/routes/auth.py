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
from models.database_models import RolEnum, UsuarioModel, ProveedorModel
from models.schemas import LoginRequest, RegistroProveedor, CambiarPassword, Token

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
    if not token:
        raise cred_error
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

def require_admin(user: UsuarioModel = Depends(get_current_user)) -> UsuarioModel:
    if user.rol != RolEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el administrador puede hacer esto",
        )
    return user


def registrar_proveedor(registro: RegistroProveedor, db: Session = Depends(get_db)):
    if db.query(UsuarioModel).filter(UsuarioModel.username == registro.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El nombre de usuario ya estÃ¡ en uso",
        )

    if db.query(ProveedorModel).filter(ProveedorModel.email == registro.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo ya estÃ¡ registrado",
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
            detail="El usuario o el correo ya estÃ¡n registrados",
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
            detail="La contraseÃ±a actual es incorrecta",
        )
    if len(body.password_nueva) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La nueva contraseÃ±a debe tener al menos 4 caracteres",
        )
    current_user.password_hash = get_password_hash(body.password_nueva)
    db.commit()
    return {"ok": True, "mensaje": "ContraseÃ±a actualizada"}
