import os

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect as sa_inspect
from sqlalchemy import text
from sqlalchemy.orm import Session

from config.database import get_db, engine
from config.security import verify_password, create_access_token
from models.database_models import Base, ClienteModel, ConductorModel, RolEnum, UsuarioModel, HistorialPedidoModel, PedidoModel, ProveedorModel
from models.schemas import LoginRequest, RegistroCliente, RegistroConductor, RegistroProveedor, CambiarPassword, Token, FotoPerfil
from routes import clientes, conductores, vehiculos, pedidos, auditoria, perfil, proveedores
from routes.auth import (
    get_current_user,
    get_current_user_optional,
    registrar_cliente,
    registrar_conductor,
    registrar_proveedor,
    cambiar_password,
)

# Crear tablas en la base de datos
Base.metadata.create_all(bind=engine)

# Migraciones ligeras: columnas nuevas en pedidos (foto/firma/historial)
def _migrar_pedidos():
    insp = sa_inspect(engine)
    if not insp.has_table("pedidos"):
        return
    cols = {c["name"] for c in insp.get_columns("pedidos")}
    alteraciones = {
        "incidencia_nota": "ALTER TABLE pedidos ADD COLUMN incidencia_nota TEXT NULL",
        "foto_entrega": "ALTER TABLE pedidos ADD COLUMN foto_entrega VARCHAR(255) NULL",
        "firma_entrega": "ALTER TABLE pedidos ADD COLUMN firma_entrega TEXT NULL",
        "entregado_at": "ALTER TABLE pedidos ADD COLUMN entregado_at DATETIME NULL",
        "id_proveedor": "ALTER TABLE pedidos ADD COLUMN id_proveedor INTEGER NULL REFERENCES proveedores (id_proveedor)",
    }
    with engine.begin() as conn:
        for col, sql in alteraciones.items():
            if col not in cols:
                conn.execute(text(sql))

_migrar_pedidos()

# Migraciones ligeras: foto de perfil en usuarios
def _migrar_usuarios():
    insp = sa_inspect(engine)
    if not insp.has_table("usuarios"):
        return
    cols = {c["name"] for c in insp.get_columns("usuarios")}
    with engine.begin() as conn:
        if "foto" not in cols:
            conn.execute(text("ALTER TABLE usuarios ADD COLUMN foto VARCHAR(255) NULL"))

_migrar_usuarios()

# Migración: garantizar que el ENUM de rol acepte PROVEEDOR en tablas ya creadas
def _migrar_rol_proveedor():
    insp = sa_inspect(engine)
    if not insp.has_table("usuarios"):
        return
    dialecto = engine.dialect.name
    if dialecto in ("mysql", "mariadb"):
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE usuarios MODIFY rol "
                "ENUM('ADMIN','CONDUCTOR','CLIENTE','PROVEEDOR') NOT NULL"
            ))
    elif dialecto == "sqlite":
        with engine.begin() as conn:
            ddl = conn.execute(text("SELECT sql FROM sqlite_master WHERE type='table' AND name='usuarios'")).scalar()
            if ddl and "PROVEEDOR" in ddl.upper():
                return
        tabla_actual = insp.get_columns("usuarios")
        def_sql = """CREATE TABLE usuarios_nueva (
            id_usuario INTEGER PRIMARY KEY,
            username VARCHAR(50) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            rol VARCHAR(10) NOT NULL CHECK (rol IN ('ADMIN','CONDUCTOR','CLIENTE','PROVEEDOR')),
            id_ref INTEGER NULL,
            foto VARCHAR(255) NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )"""
        actuales = ", ".join('"' + c["name"] + '"' for c in tabla_actual)
        with engine.begin() as conn:
            conn.execute(text("PRAGMA foreign_keys=OFF"))
            conn.execute(text(def_sql))
            conn.execute(text(
                f"INSERT INTO usuarios_nueva ({actuales}) SELECT {actuales} FROM usuarios"
            ))
            conn.execute(text("DROP TABLE usuarios"))
            conn.execute(text("ALTER TABLE usuarios_nueva RENAME TO usuarios"))

_migrar_rol_proveedor()

app = FastAPI(
    title="API Sistema de Logística y Envíos",
    description="Backend organizado en módulos",
    version="2.0.0",
    docs_url=None if os.getenv("APP_MODE") == "production" else "/docs",
    redoc_url=None if os.getenv("APP_MODE") == "production" else "/redoc",
)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.get("/version")
def version():
    return {"app": "Sistema de Logística y Envíos", "version": "1.0.0"}

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

    access_token = create_access_token(data={"sub": user.username, "rol": user.rol.value})
    auditoria.registrar(db, user.username, "LOGIN", "Inicio de sesión")
    return {
        "id_usuario": user.id_usuario,
        "usuario": user.username,
        "nombre": _nombre_real(db, user),
        "rol": user.rol.value,
        "id_ref": user.id_ref,
        "foto": user.foto,
        "access_token": access_token,
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
    if user.rol == RolEnum.PROVEEDOR and user.id_ref:
        prov = db.query(ProveedorModel).filter(ProveedorModel.id_proveedor == user.id_ref).first()
        if prov:
            return prov.nombre
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
    resultado = registrar_cliente(registro, db)
    auditoria.registrar(
        db, resultado.get("username"), "CLIENTE_AUTOREGISTRO",
        f"Registro de cliente {resultado.get('email')}",
    )
    return resultado

@app.post("/registro-conductor", status_code=status.HTTP_201_CREATED)
def registrar_conductor_route(registro: RegistroConductor, db: Session = Depends(get_db)):
    resultado = registrar_conductor(registro, db)
    auditoria.registrar(
        db, resultado.get("username"), "CONDUCTOR_ALTAREGISTRO",
        f"Autoregistro de conductor {resultado.get('nombre')}",
    )
    return resultado

@app.post("/registro-proveedor", status_code=status.HTTP_201_CREATED)
def registrar_proveedor_route(registro: RegistroProveedor, db: Session = Depends(get_db)):
    resultado = registrar_proveedor(registro, db)
    auditoria.registrar(
        db, resultado.get("username"), "PROVEEDOR_ALTAREGISTRO",
        f"Autoregistro de proveedor {resultado.get('nombre')}",
    )
    return resultado

@app.post("/cambiar-password")
def cambiar_password_route(
    body: CambiarPassword,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    resultado = cambiar_password(body, db, _user)
    auditoria.registrar(db, _user.username, "CONTRASENA_CAMBIAR", "Cambió su contraseña")
    return resultado

# ==========================================
# RUTAS DE CLIENTES
# ==========================================

@app.get("/clientes")
def get_clientes_route(db: Session = Depends(get_db)):
    return clientes.get_clientes(db)

@app.post("/clientes", status_code=status.HTTP_201_CREATED)
def crear_cliente_route(
    cliente: clientes.ClienteBase,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    resultado = clientes.crear_cliente(cliente, db)
    auditoria.registrar(db, _user.username, "CLIENTE_CREAR", f"Cliente {resultado.id_cliente}: {cliente.nombre}")
    return resultado

@app.put("/clientes/{id_cliente}")
def actualizar_cliente_route(
    id_cliente: int,
    cliente_in: clientes.ClienteBase,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    resultado = clientes.actualizar_cliente(id_cliente, cliente_in, db)
    auditoria.registrar(db, _user.username, "CLIENTE_EDITAR", f"Cliente {id_cliente}: {cliente_in.nombre}")
    return resultado

@app.delete("/clientes/{id_cliente}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_cliente_route(
    id_cliente: int,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    clientes.eliminar_cliente(id_cliente, db)
    auditoria.registrar(db, _user.username, "CLIENTE_ELIMINAR", f"Cliente {id_cliente}")

# ==========================================
# RUTAS DE CONDUCTORES
# ==========================================

@app.get("/conductores")
def get_conductores_route(db: Session = Depends(get_db)):
    return conductores.get_conductores(db)

@app.post("/conductores", status_code=status.HTTP_201_CREATED)
def crear_conductor_route(
    conductor: conductores.ConductorBase,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    resultado = conductores.crear_conductor(conductor, db)
    auditoria.registrar(db, _user.username, "CONDUCTOR_CREAR", f"Conductor {resultado['id_conductor']}: {conductor.nombre} (user {resultado.get('username')})")
    return resultado

@app.put("/conductores/{id_conductor}")
def actualizar_conductor_route(
    id_conductor: int,
    cond_in: conductores.ConductorBase,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    resultado = conductores.actualizar_conductor(id_conductor, cond_in, db)
    auditoria.registrar(db, _user.username, "CONDUCTOR_EDITAR", f"Conductor {id_conductor}: {cond_in.nombre}")
    return resultado

@app.delete("/conductores/{id_conductor}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_conductor_route(
    id_conductor: int,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    conductores.eliminar_conductor(id_conductor, db)
    auditoria.registrar(db, _user.username, "CONDUCTOR_ELIMINAR", f"Conductor {id_conductor}")

# ==========================================
# RUTAS DE PROVEEDORES
# ==========================================

@app.get("/proveedores")
def get_proveedores_route(db: Session = Depends(get_db)):
    return proveedores.get_proveedores(db)

@app.post("/proveedores", status_code=status.HTTP_201_CREATED)
def crear_proveedor_route(
    proveedor: proveedores.ProveedorBase,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    resultado = proveedores.crear_proveedor(proveedor, db)
    auditoria.registrar(db, _user.username, "PROVEEDOR_CREAR", f"Proveedor {resultado.id_proveedor}: {proveedor.nombre}")
    return resultado

@app.put("/proveedores/{id_proveedor}")
def actualizar_proveedor_route(
    id_proveedor: int,
    prov_in: proveedores.ProveedorBase,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    resultado = proveedores.actualizar_proveedor(id_proveedor, prov_in, db)
    auditoria.registrar(db, _user.username, "PROVEEDOR_EDITAR", f"Proveedor {id_proveedor}: {prov_in.nombre}")
    return resultado

@app.delete("/proveedores/{id_proveedor}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_proveedor_route(
    id_proveedor: int,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    proveedores.eliminar_proveedor(id_proveedor, db)
    auditoria.registrar(db, _user.username, "PROVEEDOR_ELIMINAR", f"Proveedor {id_proveedor}")

# ==========================================
# RUTAS DE VEHÍCULOS
# ==========================================

@app.get("/vehiculos")
def get_vehiculos_route(db: Session = Depends(get_db)):
    return vehiculos.get_vehiculos(db)

@app.post("/vehiculos", status_code=status.HTTP_201_CREATED)
def crear_vehiculo_route(
    vehiculo: vehiculos.VehiculoBase,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    resultado = vehiculos.crear_vehiculo(vehiculo, db)
    auditoria.registrar(db, _user.username, "VEHICULO_CREAR", f"Vehículo {resultado.id_vehiculo}: {vehiculo.placa}")
    return resultado

@app.put("/vehiculos/{id_vehiculo}")
def actualizar_vehiculo_route(
    id_vehiculo: int,
    veh_in: vehiculos.VehiculoBase,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    resultado = vehiculos.actualizar_vehiculo(id_vehiculo, veh_in, db)
    auditoria.registrar(db, _user.username, "VEHICULO_EDITAR", f"Vehículo {id_vehiculo}: {veh_in.placa}")
    return resultado

@app.delete("/vehiculos/{id_vehiculo}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_vehiculo_route(
    id_vehiculo: int,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    vehiculos.eliminar_vehiculo(id_vehiculo, db)
    auditoria.registrar(db, _user.username, "VEHICULO_ELIMINAR", f"Vehículo {id_vehiculo}")

# ==========================================
# RUTAS DE PEDIDOS
# ==========================================

@app.get("/pedidos")
def get_pedidos_route(db: Session = Depends(get_db)):
    return pedidos.get_pedidos(db)

@app.get("/pedidos/{id_pedido}/historial")
def historial_pedido_route(id_pedido: int, db: Session = Depends(get_db)):
    return pedidos.obtener_historial(id_pedido, db)

@app.get("/api/pedidos")
def listar_pedidos_filtrados_route(
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    return pedidos.listar_pedidos_filtrados(db, _user)

@app.post("/pedidos", status_code=status.HTTP_201_CREATED)
def crear_pedido_route(
    pedido_in: pedidos.PedidoCreate,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    resultado = pedidos.crear_pedido(pedido_in, db, _user)
    auditoria.registrar(
        db, _user.username, "PEDIDO_CREAR",
        f"Pedido {resultado.id_pedido} para cliente {pedido_in.id_cliente} ({resultado.estado.value})",
    )
    return resultado

@app.put("/pedidos/{id_pedido}")
def actualizar_pedido_completo_route(
    id_pedido: int,
    pedido_in: pedidos.PedidoCreate,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    resultado = pedidos.actualizar_pedido_completo(id_pedido, pedido_in, db, _user)
    auditoria.registrar(
        db, _user.username, "PEDIDO_EDITAR",
        f"Pedido {id_pedido} → {resultado.estado.value}, conductor {pedido_in.id_conductor}, vehículo {pedido_in.id_vehiculo}",
    )
    return resultado

@app.put("/pedidos/{id_pedido}/estado")
def actualizar_estado_pedido_route(
    id_pedido: int,
    estado_in: pedidos.PedidoUpdateState,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    resultado = pedidos.actualizar_estado_pedido(id_pedido, estado_in, db, _user)
    auditoria.registrar(
        db, _user.username, "PEDIDO_ESTADO",
        f"Pedido {id_pedido} → {estado_in.estado.value}"
        + (f" · {estado_in.nota[:80]}" if estado_in.nota else ""),
    )
    return resultado

@app.delete("/pedidos/{id_pedido}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_pedido_route(
    id_pedido: int,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    pedidos.eliminar_pedido(id_pedido, db)
    auditoria.registrar(db, _user.username, "PEDIDO_ELIMINAR", f"Pedido {id_pedido}")

# ==========================================
# RUTAS DE AUDITORÍA Y PERFIL
# ==========================================

@app.get("/auditoria")
def get_auditoria_route(
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
    limite: int = 200,
):
    if _user.rol != RolEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el administrador puede ver la auditoría",
        )
    return auditoria.get_auditoria(db, limite)

@app.post("/usuario/foto")
def subir_foto_route(
    body: FotoPerfil,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    resultado = perfil.subir_foto(body, db, _user)
    auditoria.registrar(
        db, _user.username, "PERFIL_FOTO",
        "Actualizó su foto de perfil" if body.foto else "Quitó su foto de perfil",
    )
    return resultado

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
