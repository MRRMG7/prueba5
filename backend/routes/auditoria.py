from typing import List, Optional
from fastapi import Depends
from sqlalchemy.orm import Session

from config.database import get_db, SessionLocal
from models.database_models import AuditoriaModel
from models.schemas import AuditoriaResponse

def registrar(
    db: Session,
    usuario: Optional[str],
    accion: str,
    detalle: Optional[str] = None,
) -> None:
    sesion = SessionLocal()
    try:
        sesion.add(
            AuditoriaModel(
                usuario=(usuario or "sistema")[:100],
                accion=accion[:100],
                detalle=detalle,
            )
        )
        sesion.commit()
    finally:
        sesion.close()

def get_auditoria(
    db: Session = Depends(get_db),
    limite: int = 200,
) -> List[AuditoriaResponse]:
    return (
        db.query(AuditoriaModel)
        .order_by(AuditoriaModel.id_auditoria.desc())
        .limit(limite)
        .all()
    )