from typing import List, Optional
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from config.database import get_db
from models.database_models import ProveedorModel
from models.schemas import ProveedorBase, ProveedorResponse

def get_proveedores(db: Session = Depends(get_db)) -> List[ProveedorResponse]:
    return db.query(ProveedorModel).all()

def crear_proveedor(proveedor: ProveedorBase, db: Session = Depends(get_db)) -> ProveedorResponse:
    nuevo = ProveedorModel(**proveedor.dict())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo

def actualizar_proveedor(id_proveedor: int, proveedor_in: ProveedorBase, db: Session = Depends(get_db)) -> ProveedorResponse:
    prov = db.query(ProveedorModel).filter(ProveedorModel.id_proveedor == id_proveedor).first()
    if not prov:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    for key, val in proveedor_in.dict().items():
        setattr(prov, key, val)
    db.commit()
    db.refresh(prov)
    return prov

def eliminar_proveedor(id_proveedor: int, db: Session = Depends(get_db)):
    prov = db.query(ProveedorModel).filter(ProveedorModel.id_proveedor == id_proveedor).first()
    if not prov:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    db.delete(prov)
    db.commit()