from typing import Optional
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from config.database import get_db
from models.database_models import UsuarioModel
from models.schemas import FotoPerfil
from routes.pedidos import _guardar_foto

def subir_foto(
    body: FotoPerfil,
    db: Session = Depends(get_db),
    current_user: Optional[UsuarioModel] = None,
):
    if not current_user:
        raise HTTPException(status_code=401, detail="No autenticado")

    if not body.foto:
        current_user.foto = None
        db.commit()
        return {"foto": None}

    nombre = _guardar_foto(body.foto)
    if not nombre:
        raise HTTPException(
            status_code=400,
            detail="La imagen no es válida (se espera una foto JPG, PNG, WebP o GIF)",
        )

    current_user.foto = nombre
    db.commit()
    return {"foto": nombre}