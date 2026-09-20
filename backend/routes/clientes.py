from typing import List
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from config.database import get_db
from models.database_models import ClienteModel
from models.schemas import ClienteBase, ClienteResponse

def get_clientes(db: Session = Depends(get_db)) -> List[ClienteResponse]:
    return db.query(ClienteModel).all()

def crear_cliente(cliente: ClienteBase, db: Session = Depends(get_db)) -> ClienteResponse:
    nuevo = ClienteModel(**cliente.dict())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo

def actualizar_cliente(id_cliente: int, cliente_in: ClienteBase, db: Session = Depends(get_db)) -> ClienteResponse:
    cli = db.query(ClienteModel).filter(ClienteModel.id_cliente == id_cliente).first()
    if not cli:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    for key, val in cliente_in.dict().items():
        setattr(cli, key, val)
    db.commit()
    db.refresh(cli)
    return cli

def eliminar_cliente(id_cliente: int, db: Session = Depends(get_db)):
    cli = db.query(ClienteModel).filter(ClienteModel.id_cliente == id_cliente).first()
    if not cli:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    db.delete(cli)
    db.commit()
