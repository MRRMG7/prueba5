# Manual de instalación con Docker

Sistema de Logística y Envíos (FastAPI + MySQL + React/Vite), todo levantado
en contenedores. Con Docker no necesitás instalar Python, MySQL ni Node.

---

## 1. Requisitos

- **Docker Desktop** (Windows/Mac) o **Docker Engine + docker compose** (Linux).
  - Descargar Docker Desktop: https://www.docker.com/products/docker-desktop/
  - En Docker Desktop activar el motor: `Settings → General → Use the WSL 2
    based engine` (Windows), y esperar a que diga "Docker Desktop is running".
- Internet (para descargar las imágenes la primera vez).
- El proyecto completo ubicado en cualquier carpeta de tu PC (ej. `C:\logistica`).

> El proyecto ya trae `docker-compose.yml` con **3 servicios**:
> `db` (MySQL 8), `backend` (FastAPI, puerto 8000) y `frontend` (React, puerto 8001).
> La base de datos se crea y llena sola la primera vez con
> `data/baseDatos_corregido-v2.sql`.

---

## 2. Configurar la dirección de la API (IMPORTANTE)

El frontend llama al backend desde `frontend-react/src/api.ts`, línea 3:

```ts
export const API_URL = "http://192.168.1.22:8000";   // ← dirección vieja
```

Cambiá el valor según sea el caso:

| Situación | Usá |
|---|---|
| Probás en tu propia PC | `http://localhost:8000` |
| Otros PCs acceden por la red local | `http://LA-IP-DE-ESTA-PC:8000` |

Ejemplo (tu PC):

```ts
export const API_URL = "http://localhost:8000";
```

Guardás el archivo. Este es el **único cambio obligatorio**.

---

## 3. Levantar el sistema

Abrí una terminal en la carpeta del proyecto y ejecutá:

```bash
docker compose up -d --build
```

La primera vez tarda varios minutos (descarga imágenes y crea la base).
El comando termina rápido; **la base de datos sigue inicializándose en
segundo plano** durante ~30-60 segundos más.

Para ver que todo esté corriendo:

```bash
docker compose ps
```

Los 3 servicios deben aparecer como `Up`. Si `backend` aparece como
`Restarting`, es porque aún no logra conectar a la base: esperá unos
segundos y revisá de nuevo.

---

## 4. Entrar al sistema

| Qué | URL |
|---|---|
| Página principal / rastreo | http://localhost:8001 |
| Login de administrador | http://localhost:8001 (botón "Acceso · Iniciar sesión") |
| Documentación del API (backend) | http://localhost:8000/docs |

### Usuarios de prueba

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `123` | ADMIN (panel completo de paquetes, clientes, conductores, vehículos) |
| `rsilva` | `123` | CONDUCTOR (panel de entregas asignadas) |
| `jperez` | `123` | CLIENTE (panel en construcción) |

---

## 5. Uso diario

```bash
# Detener todo (sin borrar datos)
docker compose down

# Volver a levantar
docker compose up -d

# Ver los mensajes de los 3 servicios en vivo
docker compose logs -f

# Ver un servicio en particular
docker compose logs -f frontend
```

### Cambios en la pantalla (frontend)

El código `frontend-react/src` está montado por volumen dentro del
contenedor, así que **los cambios al código se ven al instante**:
simplemente guardá el archivo y recargá el navegador con **Ctrl+F5**
(no hace falta reiniciar nada).

> Cambios en `package.json` (dependencias nuevas) **sí** requieren
> `docker compose up -d --build frontend`.

### Cambios en páginas (HTML/CSS/JS)

Los cambios se ven con **Ctrl+F5** (recarga forzada). Si viste algo "viejo",
limpiá la caché del navegador (`Ctrl+Shift+Supr`).

---

## 6. Base de datos

- Los datos quedan guardados en el volumen `db_data` (sobreviven a `down`).
- Para **borrar todo y volver a la base inicial**:

```bash
docker compose down -v
docker compose up -d --build
```

- Para entrar a MySQL desde el host (cliente MySQL externo):

```
Host: localhost
Puerto: 3307  (el 3306 host está reservado)
Base:  logistica_db
Usuario: app_user
Clave:  password123
```

---

## 7. Problemas comunes

**a) "Port is already allocated" / puerto ocupado.** Algo ya usa el 8000,
8001 o 3307 del host. Cambiá el puerto del host en `docker-compose.yml`
(solo el número de la izquierda), ej.:

```yaml
    ports:
      - "8002:3000"
```

Después `docker compose up -d`.

**b) El login da "Failed to fetch" o no carga.** Es la dirección de la API:
revisá el paso 2 y que `http://localhost:8000/docs` funcione en el navegador.

**c) `backend` reiniciándose al inicio.** La base todavía se está creando.
Esperá 30-60 segundos y corré `docker compose ps` de nuevo.

**d) Quiero que otros equipos entren por la red local.** En ese PC, accedé a
`http://IP-DE-ESTA-PC:8001` (no localhost) y poné en `api.ts` esa misma
dirección IP con el puerto 8000. Ambos equipos deben estar en la misma red.
(En Windows puede pedir activar el acceso WSL/nueva regla de firewall para
los puertos 8000 y 8001.)

**e) "npm ci" falla al construir el frontend.** Problema de red/caché de npm;
volvé a intentar. Si persiste: `docker compose build --no-cache frontend`.

**f) Mapa del navegador en blanco.** Actualizá la página con **Ctrl+F5**.
Los tiles del mapa vienen de internet (OpenStreetMap), así que se necesita
conexión.

---

## 8. Notas

- El frontend es un **servidor de desarrollo Vite** (con recarga en vivo),
  expuesto en el puerto 8001. No es para producción.
- El frontend HTML/JS viejo (`frontend/`) no se usa; el activo es
  `frontend-react/`.
- CORS está abierto para desarrollo; las contraseñas son de prueba (`123`).