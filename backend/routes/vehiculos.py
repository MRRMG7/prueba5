from typing import List
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from config.database import get_db
from models.database_models import VehiculoModel
from models.schemas import VehiculoBase, VehiculoResponse

def get_vehiculos(db: Session = Depends(get_db)) -> List[VehiculoResponse]:
    return db.query(VehiculoModel).all()

def crear_vehiculo(vehiculo: VehiculoBase, db: Session = Depends(get_db)) -> VehiculoResponse:
    nuevo = VehiculoModel(**vehiculo.dict())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo

def actualizar_vehiculo(id_vehiculo: int, veh_in: VehiculoBase, db: Session = Depends(get_db)) -> VehiculoResponse:
    veh = db.query(VehiculoModel).filter(VehiculoModel.id_vehiculo == id_vehiculo).first()
    if not veh:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")
    for key, val in veh_in.dict().items():
        setattr(veh, key, val)
    db.commit()
    db.refresh(veh)
    return veh

def eliminar_vehiculo(id_vehiculo: int, db: Session = Depends(get_db)):
    veh = db.query(VehiculoModel).filter(VehiculoModel.id_vehiculo == id_vehiculo).first()
    if not veh:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")
    db.delete(veh)
    db.commit()
