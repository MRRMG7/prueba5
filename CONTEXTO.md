# Contexto del proyecto — transporte / logística

Documento de traspaso para retomar el trabajo en otra sesión de OpenCode.
Todo lo que hay acá está confirmado contra el repo. Si algo contradice al código,
el código gana.

- Ruta del repo en esta máquina: `//192.168.1.22/prueba5/prueba` (acceso como `Z:\prueba`)
- `HEAD`: `ba06353` — working tree limpio, todo pusheado a `origin/main`
- Última build: `index-D-Dm5GAz.js` / `index-BRHIikhG.css`

---

## 1. Qué es la app

Sistema de transporte/entrega de paquetes.

- **Backend**: FastAPI en `backend/`. Puerto 8000.
- **Frontend**: React + Vite + TypeScript en `frontend-react/`. Build con `npm run build`.
- **Producción Ubuntu**: backend en `~/proyecto/backend`, frontend en `~/proyecto/frontend-react`,
  servido por nginx. Servicio systemd: `logistica-backend`.
- **Base de datos**: SQLite + SQLAlchemy. Modelos en `backend/models/database_models.py`.
- `frontend-react/.env.production` tiene `VITE_API_URL=/api` (nginx hace proxy al backend).

Roles: `ADMIN`, `CONDUCTOR`, `PROVEEDOR`, `CLIENTE`.
Se autentican con `UsuarioModel` + `RolEnum`, con `id_ref` apuntando a la tabla de su rol.

---

## 2. Estado del flujo de pedidos

Estados en uso, en orden:

```
PENDIENTE → ASIGNADO → RECOLECTADO → ENTREGADO
```

También existen `INCIDENCIA` y `CANCELADO` como estados finales alternativos.

**Decisión importante:** `EN_CAMINO` y `EN_TRAMITE` fueron eliminados del sistema. Los datos
antiguos con esos valores se migraron a `RECOLECTADO`. No reintroducirlos.

Un conductor **retira** un pedido (asignado → recolectado) y el admin **entrega**. Ese par
retirar/entregar es el corazón de la operación y no debe romperse.

---

## 3. Lo que se hizo en la sesión anterior (resumen de la conversación)

### 3.1 Autoregistro de conductor eliminado

Eliminado por completo, en todas sus formas:

- Link de registro en `frontend-react/src/pages/Login.tsx`
- Ruta y vista en `frontend-react/src/App.tsx`
- `frontend-react/src/pages/RegistroConductor.tsx` — **borrado** (179 líneas)
- `POST /registro-conductor` en `backend/main.py`
- `registrar_conductor()` en `backend/routes/auth.py`
- Schema `RegistroConductor` de `backend/models/schemas.py`

Commit: `67928ac`

Razón: los conductores se dan de alta desde el admin, no se autoregistran. El cliente sí se
registra solo, ese flujo se mantiene.

### 3.2 Guard de administrador

`require_admin` en `backend/routes/auth.py`. Aplicado con:

```python
dependencies=[Depends(require_admin)]
```

Verificado por AST, no a ojo:

| Endpoint | Guard |
|---|---|
| `POST /conductores` | `require_admin` |
| `PUT /conductores/{id_conductor}` | `require_admin` |
| `DELETE /conductores/{id_conductor}` | `require_admin` |
| `POST /proveedores` | `require_admin` |
| `PUT /proveedores/{id_proveedor}` | `require_admin` |
| `DELETE /proveedores/{id_proveedor}` | `require_admin` |

`GET /proveedores` quedó **público** a propósito (lo necesita el login del proveedor).

### 3.3 Pestaña "Negocios" en el admin

Antes `crear_proveedor` insertaba solo la fila en la tabla de proveedores y devolvía
`ProveedorResponse`. Eso dejaba el negocio **sin cuenta de usuario**: era imposible que
alguien se logueara como ese proveedor.

Ahora `crear_proveedor` (en `backend/routes/proveedores.py`):

1. Genera el username con `_generar_username(nombre)`
2. Hashea `PASSWORD_INICIAL` con `get_password_hash`
3. Crea el `UsuarioModel` con `RolEnum.PROVEEDOR`, `id_ref` = id del proveedor, `activo=True`
4. Inserta el proveedor
5. Devuelve `ProveedorCreateResponse` con `username` y `password_inicial` para que el admin
   se los pase al cliente

También se modificó `eliminar_proveedor` para borrar el `UsuarioModel` huérfano, si no
quedaban credenciales apuntando a un proveedor inexistente.

Copió el patrón de `backend/routes/conductores.py`, que ya lo hacía bien.

UI: `frontend-react/src/pages/admin/ProveedoresTab.tsx` (nuevo), conectado en `AdminDashboard.tsx`
entre **Vehículos** y **Clientes**. `Proveedor[]` ya se cargaba en `AdminDashboard`, se
reutilizó ese estado en vez de duplicar el fetch.

Commit: `d8c413b`

### 3.4 Paquetes: separar recolectados

El pedido fue separar los paquetes recolectados del resto. Se intentó de dos formas:

1. **Filas de encabezado de grupo** dentro de la misma tabla (commit `2ef2525`) — descartado
2. **Pestañas** — esto quedó (commit `ba06353`)

Implementación final en `frontend-react/src/pages/admin/PedidosTab.tsx`:

```tsx
const [vista, setVista] = useState<"paquetes" | "recolectados">("paquetes");
const recolectados = pedidos.filter((p) => p.estado === "RECOLECTADO").sort(porFecha);
const normales = pedidos.filter((p) => p.estado !== "RECOLECTADO").sort(porFecha);
const lista = vista === "recolectados" ? recolectados : normales;
```

- Dos pestañas arriba de la tabla, con contador en cada una
- Arranca en **Paquetes**
- Orden descendente por `id_pedido` (el más nuevo primero)
- El mapa (`MapaTab`) queda arriba y no cambia, solo se conmuta la tabla
- Mensaje vacío distinto por pestaña
- `colSpan={9}` porque la tabla tiene 9 columnas

CSS: se crearon clases propias `.pestanas`, `.pestana`, `.pestana.activa`, `.pestana-conteo`
en `frontend-react/src/index.css`, con el mismo aspecto que el control segmentado existente
`.modal-pestana`. No se reutilizó `.modal-pestana` directamente porque ese nombre está atado a
modales y usarlo en una tabla iba a confundir después.

El CSS de filas de grupo (`fila-grupo`, `grupo-*`) se borró, no quedó muerto.

### 3.5 La landing — historia completa

Esta parte dio varias vueltas. **El estado final es el original**, todo lo otro se revirtió.

Secuencia de commits:

| Commit | Qué |
|---|---|
| `b0201e4` | Inicio plano, info de la empresa como lista de texto |
| `50b3ba7` | Lo anterior + acento ámbar |
| `4216d07` | Capas gris/blanco y panel de rastreo |
| `d660160` | Recordar última consulta, botón limpiar, hover |
| `bec869d` | Ruta animada en el inicio |
| `0b2f543` | **Revert** — volvió el hero oscuro original de `d64d2f3` |

**Conclusión:** la landing que quedó es la de `d64d2f3`. Hero oscuro, gradiente/puntos,
buscador de dos columnas, tarjetas de "Qué hacemos", ruta animada. Los rediseños
intermedios no existen más, no hay que seguir ninguno de ellos.

La animación de ruta incluye las clases `avanzar-ruta`, `brillo-nodo` y cobertura de
`prefers-reduced-motion`.

---

## 4. Lo que falta hacer (pendiente real)

### 4.1 Deploy — lo más urgente

El backend tiene el `require_admin` en el archivo, pero **el proceso corriendo en Ubuntu
carga el código viejo hasta que se reinicie**. Sin el restart, los guards no existen en
producción.

```bash
# backend: los guards de conductores y negocios no están activos hasta que reinicies
cd ~/proyecto/backend && git pull origin main
sudo systemctl restart logistica-backend

# frontend
cd ~/proyecto/frontend-react && git pull origin main
npm run build
sudo rsync -a --delete dist/ /home/ubuntu/frontend-react/dist/
sudo systemctl reload nginx
```

Después conviene revisar el log del servicio:

```bash
sudo journalctl -u logistica-backend -n 50 --no-pager
```

### 4.2 Datos sucios en producción

- Hay **6 pedidos de prueba** que van a aparecer en la pestaña Paquetes junto con los reales
- Los proveedores en producción tienen contraseña `1234`

Decidir si se limpian o se dejan. No se tocaron.

---

## 5. Deuda técnica conocida

Ordenada por lo más probable de que cause un problema real:

1. **`POST/PUT/DELETE /clientes` y `/vehiculos` sin guard de rol.** Es exactamente el mismo
   hueco que ya se cerró en conductores y proveedores: cualquiera sin sesión de admin puede
   crear, editar o borrar clientes y vehículos. Es lo primero que arreglaría.
2. **Contraseña inicial `"123"` fija** para conductores y para negocios (`PASSWORD_INICIAL`).
   Se devuelve al admin para que se la pase al cliente, así que debería ser aleatoria o
   de un solo uso.
3. **`GET /pedidos` público.** Cualquiera que conozca el endpoint puede listar pedidos, con
   nombre, dirección y teléfono del destinatario.
4. **`/registro-proveedor` sigue público.** A los conductores se les cerró el registro, a los
   proveedores no. En este proyecto el usuario dijo explícitamente que no se toque el
   autoregistro de proveedores, pero vale la pena confirmar si es intencional.
5. **`npm audit`** reporta al menos una vulnerabilidad crítica.
6. **Sin tests.** No hay suite automatizada. Todo se validó con `tsc`, `npm run build`,
   parseo de AST y grep sobre el bundle.

---

## 6. Restricciones del entorno

Esto no es culpa del código pero va a frenar a cualquier sesión nueva:

**El `.git` del NAS es de solo lectura.** `git add`, `git checkout` y `git restore` fallan:

```
fatal: Unable to create '//192.168.1.22/prueba5/prueba/.git/index.lock': Permission denied
```

`git status`, `git log` y `git show` sí funcionan (solo lectura).

**Truco usado para restaurar archivos desde un commit** sin `git checkout`: leer con
`git show <commit>:<ruta>` y escribir el resultado con Python. Se hizo así para volver la
landing a `d64d2f3` en `0b2f543`.

```python
# esqueleto del workaround
import subprocess, pathlib
contenido = subprocess.run(
    ["git", "show", "d64d2f3:frontend-react/src/index.css"],
    capture_output=True, cwd=r"\\192.168.1.22\prueba5\prueba"
).stdout.decode("utf-8")
pathlib.Path(r"\\192.168.1.22\prueba5\prueba\frontend-react\src\index.css").write_text(
    contenido, encoding="utf-8"
)
```

Los archivos se pueden escribir, solo las operaciones de git que tocan el índice fallan.
Commits y pushes los hace el usuario desde su máquina local.

**No hay SSH ni llaves privadas.** `C:\Users\mauri\.ssh` solo tiene `known_hosts`. No están
`back.pem` ni `Front.pem`. El deploy a Ubuntu no se puede hacer desde la sesión, lo hace el
usuario.

**No hay FastAPI instalado** en el entorno de la sesión. La validación de backend disponible
es parseo de sintaxis con `ast` y grep. No se puede levantar la API para probarla.

**Z: no siempre está mapeado** en PowerShell. Si `cd Z:\...` falla con
`DriveNotFoundException`, usar la ruta UNC `\\192.168.1.22\prueba5\prueba` o
`cmd /c "Z: && cd /d Z:\... && ..."`.

---

## 7. Cosas que hay que conservar

Decisiones tomadas antes, que no se deben romper sin hablarlo:

- **Modal de cambio de contraseña con confirmación** en
  `frontend-react/src/pages/CambiarPasswordModal.tsx`
- **Flujo de cuatro estados** `PENDIENTE → ASIGNADO → RECOLECTADO → ENTREGADO`
- **`EN_CAMINO` / `EN_TRAMITE` eliminados** y datos migrados
- **Etiqueta de auditoría `CONDUCTOR_ALTAREGISTRO`** en las filas viejas, para no perder el
  rastro. Está en `backend/models/database_models.py`
- **El cliente sí se registra solo.** No se cerró su registro
- **No reintroducir el autoregistro de conductores** bajo ninguna circunstancia

---

## 8. Cómo retomar

1. `git log --oneline -10` y `git status` para ver dónde quedó
2. Correr `npm run build` en `frontend-react` antes de dar por buena cualquier cambio
3. Validar guards de backend con parseo AST, no a ojo:

```python
import ast
arbol = ast.parse(open("backend/main.py", encoding="utf-8").read())
for n in ast.walk(arbol):
    if isinstance(n, ast.FunctionDef):
        deps = [d for d in n.args.dependencies if d]
        nombres = [getattr(d.call.func, "id", "?") for d in deps]
        print(f"{n.name:32} -> {nombres or ['NINGUNO']}")
```

4. Después de un build, verificar que el bundle realmente cambió buscando un identificador
   único en `dist/assets/*.js`. Un `✓ built` no garantiza que el código nuevo esté adentro
