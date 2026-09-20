from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from config.database import get_db, engine
from config.security import verify_password, create_access_token
from models.database_models import Base, ClienteModel, ConductorModel, RolEnum, UsuarioModel
from models.schemas import LoginRequest, RegistroCliente, Token
from routes import clientes, conductores, vehiculos, pedidos
from routes.auth import get_current_user_optional, registrar_cliente

# Crear tablas en la base de datos
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="API Sistema de Logística y Envíos",
    description="Backend organizado en módulos",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# RUTAS DE AUTENTICACIÓN
# ==========================================

@app.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(UsuarioModel).filter(UsuarioModel.username == data.username).first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
        )

    return {
        "id_usuario": user.id_usuario,
        "usuario": user.username,
        "nombre": _nombre_real(db, user),
        "rol": user.rol.value,
        "id_ref": user.id_ref,
    }

def _nombre_real(db: Session, user: UsuarioModel) -> str:
    if user.rol == RolEnum.CONDUCTOR and user.id_ref:
        c = db.query(ConductorModel).filter(ConductorModel.id_conductor == user.id_ref).first()
        if c:
            return c.nombre
    if user.rol == RolEnum.CLIENTE and user.id_ref:
        cli = db.query(ClienteModel).filter(ClienteModel.id_cliente == user.id_ref).first()
        if cli:
            return cli.nombre
    return user.username.capitalize()

@app.post("/api/token", response_model=Token)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    user = db.query(UsuarioModel).filter(UsuarioModel.username == form_data.username).first()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user.username, "rol": user.rol.value})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "rol": user.rol.value,
        "username": user.username,
    }

@app.post("/registro", status_code=status.HTTP_201_CREATED)
def registrar_cliente_route(registro: RegistroCliente, db: Session = Depends(get_db)):
    return registrar_cliente(registro, db)

# ==========================================
# RUTAS DE CLIENTES
# ==========================================

@app.get("/clientes")
def get_clientes_route(db: Session = Depends(get_db)):
    return clientes.get_clientes(db)

@app.post("/clientes", status_code=status.HTTP_201_CREATED)
def crear_cliente_route(cliente: clientes.ClienteBase, db: Session = Depends(get_db)):
    return clientes.crear_cliente(cliente, db)

@app.put("/clientes/{id_cliente}")
def actualizar_cliente_route(id_cliente: int, cliente_in: clientes.ClienteBase, db: Session = Depends(get_db)):
    return clientes.actualizar_cliente(id_cliente, cliente_in, db)

@app.delete("/clientes/{id_cliente}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_cliente_route(id_cliente: int, db: Session = Depends(get_db)):
    return clientes.eliminar_cliente(id_cliente, db)

# ==========================================
# RUTAS DE CONDUCTORES
# ==========================================

@app.get("/conductores")
def get_conductores_route(db: Session = Depends(get_db)):
    return conductores.get_conductores(db)

@app.post("/conductores", status_code=status.HTTP_201_CREATED)
def crear_conductor_route(conductor: conductores.ConductorBase, db: Session = Depends(get_db)):
    return conductores.crear_conductor(conductor, db)

@app.put("/conductores/{id_conductor}")
def actualizar_conductor_route(id_conductor: int, cond_in: conductores.ConductorBase, db: Session = Depends(get_db)):
    return conductores.actualizar_conductor(id_conductor, cond_in, db)

@app.delete("/conductores/{id_conductor}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_conductor_route(id_conductor: int, db: Session = Depends(get_db)):
    return conductores.eliminar_conductor(id_conductor, db)

# ==========================================
# RUTAS DE VEHÍCULOS
# ==========================================

@app.get("/vehiculos")
def get_vehiculos_route(db: Session = Depends(get_db)):
    return vehiculos.get_vehiculos(db)

@app.post("/vehiculos", status_code=status.HTTP_201_CREATED)
def crear_vehiculo_route(vehiculo: vehiculos.VehiculoBase, db: Session = Depends(get_db)):
    return vehiculos.crear_vehiculo(vehiculo, db)

@app.put("/vehiculos/{id_vehiculo}")
def actualizar_vehiculo_route(id_vehiculo: int, veh_in: vehiculos.VehiculoBase, db: Session = Depends(get_db)):
    return vehiculos.actualizar_vehiculo(id_vehiculo, veh_in, db)

@app.delete("/vehiculos/{id_vehiculo}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_vehiculo_route(id_vehiculo: int, db: Session = Depends(get_db)):
    return vehiculos.eliminar_vehiculo(id_vehiculo, db)

# ==========================================
# RUTAS DE PEDIDOS
# ==========================================

@app.get("/pedidos")
def get_pedidos_route(db: Session = Depends(get_db)):
    return pedidos.get_pedidos(db)

@app.get("/api/pedidos")
def listar_pedidos_filtrados_route(db: Session = Depends(get_db), token: str = None):
    return pedidos.listar_pedidos_filtrados(db, token)

@app.post("/pedidos", status_code=status.HTTP_201_CREATED)
def crear_pedido_route(pedido_in: pedidos.PedidoCreate, db: Session = Depends(get_db), token: str = None):
    return pedidos.crear_pedido(pedido_in, db, token)

@app.put("/pedidos/{id_pedido}")
def actualizar_pedido_completo_route(id_pedido: int, pedido_in: pedidos.PedidoCreate, db: Session = Depends(get_db)):
    return pedidos.actualizar_pedido_completo(id_pedido, pedido_in, db)

@app.put("/pedidos/{id_pedido}/estado")
def actualizar_estado_pedido_route(id_pedido: int, estado_in: pedidos.PedidoUpdateState, db: Session = Depends(get_db), token: str = None):
    return pedidos.actualizar_estado_pedido(id_pedido, estado_in, db, token)

@app.delete("/pedidos/{id_pedido}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_pedido_route(id_pedido: int, db: Session = Depends(get_db)):
    return pedidos.eliminar_pedido(id_pedido, db)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
