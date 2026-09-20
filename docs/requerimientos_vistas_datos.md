# Requerimientos de datos del frontend — Definición de vistas (V1)

> Documento de contrato backend ↔ frontend.
> El frontend **solo consume vistas** (los endpoints devuelven exactamente lo que define cada vista).
> Versión: 1.0 · Semana del 21/09/2026 · El Salvador.

---

## 1. Reglas generales de seguridad de datos

| # | Regla |
|---|-------|
| R1 | **Nunca** se devuelve `password_hash`. La vista de usuarios lo excluye por definición. |
| R2 | Todo listado se filtra por rol **en el propio SELECT** de la vista (`WHERE ...`), nunca en el frontend. |
| R3 | El filtro por rol se parametriza con `id_ref` (id del conductor/cliente logueado) y con `rol`. El backend inyecta estos valores al consultar la vista. |
| R4 | Conteos = una vista `GROUP BY`, no un arreglo hecho en el frontend. |
| R5 | Nombres en mayúscula/minúscula literal: `id_cliente`, `id_conductor`, `id_vehiculo` (kebab de las tablas + sufijos `_nombre`). |
| R6 | Coordenadas siempre numéricas (decimal), `estado` en texto exacto en `MAYÚSCULAS`. |
| R7 | Orden de salida definido por fila de cada vista y respetado por el endpoint (el frontend NO reordena listas grandes). |

### Matriz de acceso por rol

| Vista | ADMIN | CONDUCTOR | CLIENTE |
|-------|-------|-----------|---------|
| v_usuarios | Todas las filas + `nombre` real | — | — |
| v_clientes | Todas | Solo `id_cliente`, `nombre` | Solo su fila |
| v_conductores | Todas | Solo su fila | — |
| v_vehiculos | Todas | Todas | — |
| v_pedidos | Todas | `WHERE id_conductor = id_ref` | `WHERE id_cliente = id_ref` |
| v_reparto_conductor | Todas las filas | — | — |
| v_conteos_estado | todas | sus pedidos activos | sus pedidos |

---

## 2. Vistas definidas

### V1 — `v_usuarios` (login + gestión de usuarios, solo ADMIN)

**Propósito:** autenticar y mostrar usuarios del sistema sin exponer contraseñas.

```sql
SELECT
    u.id_usuario,
    u.username,
    u.rol,
    u.id_ref,
    COALESCE(cl.nombre, co.nombre, 'Admin') AS nombre,  -- nombre real del cliente/conductor
    u.created_at
FROM usuarios u
LEFT JOIN clientes    cl ON cl.id_cliente    = u.id_ref AND u.rol = 'CLIENTE'
LEFT JOIN conductores co ON co.id_conductor = u.id_ref AND u.rol = 'CONDUCTOR';
```

**Reglas:**
- No incluye `password_hash` en ninguna forma.
- `GET /login` devuelve de esta vista: `{ id_usuario, usuario, nombre, rol, id_ref }` (campo `usuario` = `username`).
- Solo el rol ADMIN la lista completa.

---

### V2 — `v_clientes`

```sql
SELECT
    c.id_cliente,
    c.nombre,
    c.telefono,
    c.email,
    c.direccion,
    u.username   -- usuario de acceso del cliente (si existe)
FROM clientes c
LEFT JOIN usuarios u ON u.id_ref = c.id_cliente AND u.rol = 'CLIENTE';
```

**Reglas de fila:**
- ADMIN → todas las filas.
- CONDUCTOR → solo las columnas `id_cliente`, `nombre` (para saber a quién entrega).
- CLIENTE → solo su fila (`id_cliente = id_ref`).

---

### V3 — `v_conductores`

```sql
SELECT
    co.id_conductor,
    co.nombre,
    co.email,
    co.telefono,
    co.licencia,
    u.username AS usuario,   -- usuario de acceso generado
    u.id_usuario
FROM conductores co
LEFT JOIN usuarios u ON u.id_ref = co.id_conductor AND u.rol = 'CONDUCTOR';
```

**Reglas de fila:**
- ADMIN → todas las filas.
- CONDUCTOR → solo su fila (`id_conductor = id_ref`).
- CLIENTE → sin acceso.

---

### V4 — `v_vehiculos`

```sql
SELECT id_vehiculo, placa, tipo, capacidad
FROM vehiculos;
```

**Reglas de fila:** ADMIN y CONDUCTOR → todas. CLIENTE → sin acceso.

---

### V5 — `v_pedidos` (vista principal)

**Propósito:** todo lo que el frontend pinta de un pedido (tablas, conteos, mapa), con nombres resueltos.

```sql
SELECT
    p.id_pedido,
    p.id_cliente,
    cl.nombre     AS nombre_cliente,
    cl.telefono   AS telefono_cliente,
    p.id_conductor,
    co.nombre     AS nombre_conductor,
    p.id_vehiculo,
    vh.placa      AS placa_vehiculo,
    vh.tipo       AS tipo_vehiculo,
    p.direccion,
    CAST(p.latitud  AS DOUBLE) AS latitud,
    CAST(p.longitud AS DOUBLE) AS longitud,
    p.estado,
    p.created_at
FROM pedidos p
LEFT JOIN clientes    cl ON cl.id_cliente    = p.id_cliente
LEFT JOIN conductores co ON co.id_conductor  = p.id_conductor
LEFT JOIN vehiculos   vh ON vh.id_vehiculo   = p.id_vehiculo;
```

**Reglas de fila (parámetros `rol` + `id_ref`):**
```sql
WHERE ( :rol = 'ADMIN' )
   OR ( :rol = 'CONDUCTOR' AND p.id_conductor = :id_ref )
   OR ( :rol = 'CLIENTE' AND p.id_cliente = :id_ref );
```

**Orden de salida:** `ORDER BY p.id_pedido DESC`.

---

### V6 — `v_conteos_estado` (conteos en una sola fila)

**Propósito:** los contadores que usan los 3 paneles, calculados por la vista seg�un el rol. Inyecta el mismo filtro de fila que V5.

```sql
SELECT
    COUNT(*)                                          AS total,
    SUM(p.estado = 'PENDIENTE')                       AS pendientes,
    SUM(p.estado = 'ASIGNADO')                        AS asignados,
    SUM(p.estado = 'EN_CAMINO')                       AS en_camino,
    SUM(p.estado = 'ENTREGADO')                       AS entregados,
    SUM(p.estado = 'INCIDENCIA')                      AS incidencias,
    SUM(p.estado = 'CANCELADO')                       AS cancelados,
    SUM(p.id_conductor IS NULL)                       AS sin_asignar           -- solo admin relevante
FROM v_pedidos
WHERE ( :rol = 'ADMIN' ) OR ( :rol = 'CONDUCTOR' AND id_conductor = :id_ref ) OR ( :rol = 'CLIENTE' AND id_cliente = :id_ref );
```

---

### V7 — `v_reparto_conductor` (solo ADMIN)

**Propósito:** tabla "Reparto por conductor" del panel admin.

```sql
SELECT
    co.id_conductor,
    co.nombre,
    co.licencia,
    COALESCE(SUM(p.estado = 'EN_CAMINO'),   0) AS en_ruta,
    COALESCE(SUM(p.estado = 'ENTREGADO'),   0) AS entregados,
    COALESCE(SUM(p.estado = 'INCIDENCIA'),  0) AS incidencias,
    COUNT(p.id_pedido)                          AS total_pedidos
FROM conductores co
LEFT JOIN pedidos p ON p.id_conductor = co.id_conductor
GROUP BY co.id_conductor, co.nombre, co.licencia
ORDER BY co.nombre;
```

**Regla:** incluye conductores sin pedidos (LEFT JOIN → 0).

---

## 3. Contrato de endpoints (lo que el frontend consume)

| Endpoint existente | Retroalimenta de | Frontend usa |
|---|---|---|
| `POST /login` | v_usuarios | panel según `rol`, `nombre` en título, `id_ref` para id |
| `GET /clientes` | v_clientes | selects y tabla cliente |
| `GET /conductores` | v_conductores | tabla reparto, CRUD, selects de asignación |
| `GET /vehiculos` | v_vehiculos | tabla vehículos, select de asignación |
| `GET /pedidos` | v_pedidos + filtro rol | todas las tablas de pedidos y mapa |
| `GET /conteos` *(nuevo, opcional)* | v_conteos_estado | contadores de cada panel |
| `GET /reparto` *(nuevo, opcional)* | v_reparto_conductor | tabla Reparto por conductor |

> El frontend actual descarga `clientes`, `conductores`, `vehiculos` y `pedidos`, y calcula los conteos localmente. Si backend entrega `conteos` y `reparto`, el frontend deja de calcularlos (regla R4).

---

## 4. Datos por pantalla (qué pinta cada panel — reglas finales)

### Panel ADMIN
- **Conteos:** pendientes, asignados, en camino, entregados, incidencias, cancelados, sin asignar (V6 sin filtro de conductor).
- **Tabla pedidos:** `#id`, `nombre_cliente`, `direccion`, `estado`, picker de conductor (`v_conductores`), botones Editar / Reasignar / Retirar.
- **Reparto por conductor:** nombre + punto de estado (local), en_ruta, entregados, incidencias, licencia (V7).
- **CRUD conductores:** nombre, email, licencia, teléfono (V3) — al crear regresa `usuario` y contraseña inicial.
- **CRUD vehículos:** placa, tipo, capacidad (V4).
- **Registrar/editar pedido:** clientes (V2), conductores (V3), vehículos (V4), direccion+latitud+longitud del pin.
- **Geolocalizar:** todos los pedidos activos con coords (V5 sin filtro, `estado <> 'CANCELADO'`).

### Panel CONDUCTOR
- **Conteos:** del día (activos), pendientes (PENDIENTE+ASIGNADO), en camino, entregados (V6 filtrado por `id_conductor = id_ref`).
- **Reporte del día:** paquetes asignados, entregados, en recorrido (ASIGNADO+EN_CAMINO), incidencias — derivado de V5 filtrada.
- **Mi ruta:** solo sus pedidos no `CANCELADO`/`INCIDENCIA`: `#id`, `nombre_cliente`, `direccion`, `estado` + botones según estado.
- **Mapa:** sus pedidos activos con coordenadas.

### Panel CLIENTE
- **Conteos:** pendientes, asignados, en camino, entregados, cancelados (V6 filtrado por `id_cliente = id_ref`).
- **Mis pedidos:** `#id`, `estado`, `direccion`, `nombre_conductor` o "en preparación", botón Cancelar si `PENDIENTE`.
- **Mapa:** sus pedidos activos con coordenadas.

---

## 5. Ejemplo de datos para probar las vistas

Usuarios mínimos (ya en seed):
```
admin  / 123  ADMIN   id_ref NULL
rsilva / 123  CONDUCTOR id_ref 1
jperez / 123  CLIENTE  id_ref 1
```

Resultado esperado al llamar `GET /pedidos` con:
- **admin/123** → 2 pedidos.
- **rsilva/123** → solo pedido con `id_conductor = 1`.
- **jperez/123** → solo pedido con `id_cliente = 1`.

---

## 6. Pendiente para backend (aceptación)

- [ ] Crear las vistas V1–V7 en MySQL.
- [ ] Los endpoints `GET /clientes, /conductores, /vehiculos, /pedidos` consultan las vistas y aplican el filtro `rol`/`id_ref`.
- [ ] (`opcional`) Endpoints `GET /conteos` y `GET /reparto`.
- [ ] Eliminar exposición de `password_hash` en cualquier respuesta.
- [ ] Los emails/usuarios se devuelven sin datos de autenticación.