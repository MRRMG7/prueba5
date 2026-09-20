# Sistema de Logística y Envíos

Backend Python (FastAPI) + Frontend HTML/JavaScript organizado en módulos.

## Requisitos

- Python 3.14.4
- MySQL 8.0+ (o MariaDB compatible)

## Estructura del Proyecto

```
prueba/
├── backend/                 # Backend Python (FastAPI)
│   ├── config/             # Configuración
│   │   ├── database.py     # Conexión a base de datos
│   │   └── security.py     # Seguridad y JWT
│   ├── models/             # Modelos de datos
│   │   ├── database_models.py  # Modelos SQLAlchemy
│   │   └── schemas.py      # Esquemas Pydantic
│   ├── routes/             # Rutas de la API
│   │   ├── auth.py         # Autenticación
│   │   ├── clientes.py     # Endpoints de clientes
│   │   ├── conductores.py  # Endpoints de conductores
│   │   ├── vehiculos.py    # Endpoints de vehículos
│   │   └── pedidos.py      # Endpoints de pedidos
│   ├── main.py             # Punto de entrada de la aplicación
│   └── __init__.py
├── frontend/               # Frontend (HTML/CSS/JS)
│   ├── index.html          # Página principal
│   ├── css/                # Estilos
│   ├── js/                 # JavaScript
│   └── assets/             # Imágenes y recursos
├── data/                   # Datos y scripts SQL
│   └── baseDatos_corregido-v2.txt
├── docs/                   # Documentación
│   └── dependencias.txt
├── venv/                   # Entorno virtual Python
├── requirements.txt        # Dependencias Python
└── README.md              # Este archivo
```

## Instalación

### 1. Crear entorno virtual

```bash
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# o
venv\Scripts\activate     # Windows
```

### 2. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 3. Configurar base de datos MySQL

Crear base de datos `logistica_db` y usuario `app_user` con contraseña `password123`:

```sql
CREATE DATABASE logistica_db;
CREATE USER 'app_user'@'localhost' IDENTIFIED BY 'password123';
GRANT ALL PRIVILEGES ON logistica_db.* TO 'app_user'@'localhost';
FLUSH PRIVILEGES;
```

O modificar la URL en `backend/config/database.py` según tu configuración.

### 4. Ejecutar script de base de datos (opcional)

```bash
mysql -u app_user -p logistica_db < data/baseDatos_corregido-v2.txt
```

## Ejecución

### Backend

```bash
cd backend
python main.py
```

El servidor se iniciará en `http://localhost:8000`

### Frontend

Opción 1: Servidor HTTP simple

```bash
cd frontend
python3 -m http.server 8001
```

Opción 2: Abrir directamente `frontend/index.html` en el navegador

## API Endpoints

### Autenticación
- `POST /login` - Login simple
- `POST /api/token` - Login con token JWT

### Clientes
- `GET /clientes` - Listar todos
- `POST /clientes` - Crear cliente
- `PUT /clientes/{id}` - Actualizar cliente
- `DELETE /clientes/{id}` - Eliminar cliente

### Conductores
- `GET /conductores` - Listar todos
- `POST /conductores` - Crear conductor
- `PUT /conductores/{id}` - Actualizar conductor
- `DELETE /conductores/{id}` - Eliminar conductor

### Vehículos
- `GET /vehiculos` - Listar todos
- `POST /vehiculos` - Crear vehículo
- `PUT /vehiculos/{id}` - Actualizar vehículo
- `DELETE /vehiculos/{id}` - Eliminar vehículo

### Pedidos
- `GET /pedidos` - Listar todos
- `GET /api/pedidos` - Listar con filtros por rol
- `POST /pedidos` - Crear pedido
- `PUT /pedidos/{id}` - Actualizar pedido completo
- `PUT /pedidos/{id}/estado` - Actualizar estado
- `DELETE /pedidos/{id}` - Eliminar pedido

## Usuarios de Prueba

- **admin** / `123` (Rol: ADMIN)
- **conductor1** / `123` (Rol: CONDUCTOR)
- **cliente1** / `123` (Rol: CLIENTE)

## Dependencias

- fastapi==0.109.0
- uvicorn[standard]==0.27.0
- sqlalchemy==2.0.25
- pymysql==1.1.0
- pydantic==2.5.3
- pydantic-settings==2.1.0
- python-jose[cryptography]==3.3.0
- passlib[bcrypt]==1.7.4
- python-multipart==0.0.6
- python-dateutil==2.8.2

## Notas

- Los passwords se almacenan en texto plano (sin encriptación) para desarrollo
- CORS está habilitado para todos los orígenes (solo para desarrollo)
- La base de datos MySQL debe estar ejecutándose antes de iniciar el backend
