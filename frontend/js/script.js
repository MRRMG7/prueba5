/* =========================================================
   Transporte & Entregas — frontend conectado al API REST
   Backend FastAPI en http://localhost:8000
   Sin dependencias (solo MapLibre GL desde CDN).
   ========================================================= */
"use strict";

/* ---------------- Utilidades ---------------- */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function esc(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

const API_URL = "http://192.168.1.22:8000";

async function api(url, opciones = {}) {
  const res = await fetch(API_URL + url, { ...opciones, cache: "no-store" });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    let mensaje = `Error ${res.status}`;
    if (data && typeof data.detail === "string") mensaje = data.detail;
    else if (data && Array.isArray(data.detail) && data.detail.length) {
      mensaje = `Datos inválidos: ${data.detail[0].msg || "revisá los campos."}`;
    }
    throw new Error(mensaje);
  }
  if (res.status === 204) return null;
  return res.json();
}

function mensajeRed(err) {
  return err.name === "TypeError" || err instanceof SyntaxError
    ? "No se pudo conectar con el servidor. Verificá que el backend esté corriendo en http://localhost:8000."
    : err.message;
}

/* ---------------- Modelo (estados del backend) ---------------- */
const ESTADO_META = {
  PENDIENTE:   { etiqueta: "Pendiente",   color: "#64748b", fondo: "#f1f5f9" },
  ASIGNADO:    { etiqueta: "Asignado",    color: "#334155", fondo: "#eef0f3" },
  EN_CAMINO:   { etiqueta: "En camino",   color: "#9a6410", fondo: "rgba(245,166,35,.14)" },
  ENTREGADO:   { etiqueta: "Entregado",   color: "#0b8378", fondo: "rgba(46,196,182,.14)" },
  INCIDENCIA:  { etiqueta: "Incidencia",  color: "#c2410c", fondo: "rgba(243,108,44,.14)" },
  CANCELADO:   { etiqueta: "Cancelado",   color: "#c23333", fondo: "rgba(239,75,75,.12)" },
};

function pillEstado(estado) {
  const meta = ESTADO_META[estado] || { etiqueta: estado, color: "#64748b", fondo: "#f1f5f9" };
  return `<span class="pill" style="color:${meta.color};background:${meta.fondo}">${esc(meta.etiqueta)}</span>`;
}

const CLAVE_CONDUCTORES = "transporte:conductor-estados:v2";

/* ---------------- Estado de la app ---------------- */
const estado = {
  rol: null,          // 'admin' | 'conductor' | 'cliente'
  nombre: null,
  usuario: null,
  idRef: null,        // id del cliente/conductor relacionado (id_ref del usuario)
  clientes: [],
  conductores: [],
  vehiculos: [],
  pedidos: [],
  conectado: true,
  mapas: { admin: null, conductor: null, cliente: null },
};

/* ---------------- Tiempo real (polling) ---------------- */
let intervaloReal = null;
let pollingActivo = false;

function iniciarTiempoReal() {
  detenerTiempoReal();
  intervaloReal = setInterval(() => refrescarEnVivo(), 3000);
}

async function refrescarEnVivo() {
  if (pollingActivo || document.hidden || !estado.rol) return;
  pollingActivo = true;
  try {
    await cargarPedidos();
    if (estado.rol === "admin") renderAdmin();
    if (estado.rol === "conductor") renderConductor();
    if (estado.rol === "cliente") renderCliente();
  } catch {
    // sin conexión momentánea: se reintenta en el próximo tick
  } finally {
    pollingActivo = false;
  }
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && estado.rol) refrescarEnVivo();
});

function detenerTiempoReal() {
  if (intervaloReal) {
    clearInterval(intervaloReal);
    intervaloReal = null;
  }
}

/* ---------------- Datos desde el API ---------------- */
function normalizarPedido(p) {
  p.latitud = Number(p.latitud) || 0;
  p.longitud = Number(p.longitud) || 0;
  return p;
}

async function cargarPedidos() {
  const pedidos = await api("/pedidos");
  estado.pedidos = (pedidos || []).map(normalizarPedido);
  refrescarGeolocalizaciones();
}

async function cargarDatos() {
  const [clientes, conductores, vehiculos, pedidos] = await Promise.all([
    api("/clientes"),
    api("/conductores"),
    api("/vehiculos"),
    api("/pedidos"),
  ]);
  estado.clientes = clientes || [];
  estado.conductores = conductores || [];
  estado.vehiculos = vehiculos || [];
  estado.pedidos = (pedidos || []).map(normalizarPedido);
}

function clientePorId(id) { return estado.clientes.find((c) => c.id_cliente === id); }
function conductorPorId(id) { return estado.conductores.find((c) => c.id_conductor === id); }
function nombreCliente(id) { const c = clientePorId(id); return c ? c.nombre : (id ? `Cliente #${id}` : "—"); }
function nombreConductor(id) { const c = conductorPorId(id); return c ? c.nombre : (id ? `Conductor #${id}` : "Sin asignar"); }
function nombreClientePedido(p) { return (p.cliente && p.cliente.nombre) ? p.cliente.nombre : nombreCliente(p.id_cliente); }
function nombreConductorPedido(p) { return (p.conductor && p.conductor.nombre) ? p.conductor.nombre : nombreConductor(p.id_conductor); }
function pedidoPorId(id) { return estado.pedidos.find((p) => p.id_pedido === Number(id)); }

/* Conexión del conductor (estado local, por ID) */
function leerConexion(idConductor) {
  try {
    const mapa = JSON.parse(localStorage.getItem(CLAVE_CONDUCTORES) || "{}");
    return mapa[String(idConductor)]?.conectado ?? true;
  } catch { return true; }
}
function guardarConexion(idConductor, conectado) {
  let mapa = {};
  try { mapa = JSON.parse(localStorage.getItem(CLAVE_CONDUCTORES) || "{}"); } catch { mapa = {}; }
  mapa[String(idConductor)] = { conectado };
  localStorage.setItem(CLAVE_CONDUCTORES, JSON.stringify(mapa));
}

/* Cuerpo para PUT /pedidos/{id} (PedidoCreate) */
function cuerpoPedido(p) {
  return {
    id_cliente: p.id_cliente,
    direccion: p.direccion,
    latitud: p.latitud,
    longitud: p.longitud,
    id_conductor: p.id_conductor ?? null,
    id_vehiculo: p.id_vehiculo ?? null,
    estado: p.estado,
  };
}

async function asignarPedido(p, idConductor) {
  const cambios = {
    ...cuerpoPedido(p),
    id_conductor: idConductor || null,
    estado: idConductor ? "ASIGNADO" : "PENDIENTE",
  };
  await api(`/pedidos/${p.id_pedido}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cambios),
  });
}

async function cambiarEstado(p, estadoNuevo) {
  await api(`/pedidos/${p.id_pedido}/estado`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estado: estadoNuevo }),
  });
}

/* ---------------- Router ---------------- */
function mostrarVista(id) {
  for (const el of $$(".pantalla, .panel")) el.classList.add("oculto");
  $("#" + id).classList.remove("oculto");
  window.scrollTo({ top: 0 });
}

function entrarComo() {
  estado.conectado = estado.rol === "conductor" ? leerConexion(estado.idRef) : true;
  const titulo = $("#titulo-conductor");
  if (titulo) titulo.textContent = `${estado.nombre || "Conductor"} · Mi jornada`;
  if (estado.rol === "admin") renderAdmin();
  if (estado.rol === "conductor") renderConductor();
  if (estado.rol === "cliente") renderCliente();
  mostrarVista(
    estado.rol === "admin" ? "panel-admin"
      : estado.rol === "conductor" ? "panel-conductor"
      : "panel-cliente"
  );
  if (estado.rol === "admin") obtenerMapa("admin");
  if (estado.rol === "conductor") obtenerMapa("conductor");
  if (estado.rol === "cliente") obtenerMapa("cliente");
  iniciarTiempoReal();
}

/* =========================================================
   LOGIN / REGISTRO
   ========================================================= */
function enlazarRolTabs() {
  const tabsLogin = $("#login-roles");
  tabsLogin.addEventListener("click", (e) => {
    const b = e.target.closest(".rol-btn");
    if (!b) return;
    $$(".rol-btn", tabsLogin).forEach((x) => x.classList.toggle("activo", x === b));
  });

  const tabsReg = $("#registro-roles");
  tabsReg.addEventListener("click", (e) => {
    const b = e.target.closest(".rol-btn");
    if (!b) return;
    $$(".rol-btn", tabsReg).forEach((x) => x.classList.toggle("activo", x === b));
    $("#campo-licencia").classList.toggle("oculto", b.dataset.tipo !== "conductor");
  });
}

function mostrarErrorLogin(mensaje) {
  let aviso = $("#error-login");
  if (!aviso) {
    aviso = document.createElement("p");
    aviso.id = "error-login";
    aviso.style.cssText = "color:#c23333;font-size:12.5px;background:rgba(239,75,75,.1);border:1px solid rgba(239,75,75,.3);border-radius:8px;padding:10px 12px;";
    $("#form-login").insertAdjacentElement("beforebegin", aviso);
  }
  aviso.textContent = mensaje;
}

function mostrarErrorRegistro(mensaje) {
  let aviso = $("#error-registro");
  if (!aviso) {
    aviso = document.createElement("p");
    aviso.id = "error-registro";
    aviso.style.cssText = "color:#c23333;font-size:12.5px;background:rgba(239,75,75,.1);border:1px solid rgba(239,75,75,.3);border-radius:8px;padding:10px 12px;";
    $("#form-registro").insertAdjacentElement("beforebegin", aviso);
  }
  aviso.textContent = mensaje;
}

function mostrarExitoRegistro(mensaje) {
  let aviso = $("#exito-registro");
  if (!aviso) {
    aviso = document.createElement("p");
    aviso.id = "exito-registro";
    aviso.style.cssText = "color:#0b8378;font-size:12.5px;background:rgba(46,196,182,.12);border:1px solid rgba(46,196,182,.4);border-radius:8px;padding:10px 12px;";
    $("#form-login").insertAdjacentElement("beforebegin", aviso);
  }
  aviso.textContent = mensaje;
}

$("#form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#exito-registro")?.remove();
  $("#error-login")?.remove();
  const fd = new FormData(e.target);
  const usuario = String(fd.get("usuario")).trim();
  const password = String(fd.get("password"));

  if (!usuario || !password) {
    mostrarErrorLogin("Ingresá tu usuario y contraseña.");
    return;
  }

  try {
    const data = await api("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: usuario, password }),
    });

    estado.rol = String(data.rol).toLowerCase();
    estado.nombre = data.nombre || usuario;
    estado.usuario = data.usuario;
    estado.idRef = data.id_ref;

    const btn = $(`[data-rol="${estado.rol}"]`, $("#login-roles"));
    $$(".rol-btn", $("#login-roles")).forEach((x) => x.classList.toggle("activo", x === btn));

    await cargarDatos();
    entrarComo();
  } catch (err) {
    mostrarErrorLogin(mensajeRed(err));
  }
});

$("#form-registro").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#error-registro")?.remove();
  const fd = new FormData(e.target);
  const nombre = String(fd.get("nombre")).trim();
  const usuario = String(fd.get("usuario")).trim();
  const email = String(fd.get("email")).trim();
  const telefono = String(fd.get("telefono")).trim();
  const direccion = String(fd.get("direccion")).trim();
  const password = String(fd.get("password"));
  const tipo = $(".rol-btn.activo", $("#registro-roles")).dataset.tipo;

  if (!nombre || !usuario || !email || !password) {
    mostrarErrorRegistro("Completá nombre, usuario, correo y contraseña.");
    return;
  }
  if (tipo === "conductor") {
    mostrarErrorRegistro("El registro de conductores lo realiza el administrador. Elegí Cliente para crear tu cuenta.");
    return;
  }

  try {
    await api("/registro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre,
        telefono,
        email,
        direccion,
        username: usuario,
        password,
        rol: "cliente",
      }),
    });

    mostrarExitoRegistro("Cuenta creada con éxito. Ya podés iniciar sesión.");
    mostrarVista("vista-login");
    $("#form-registro").reset();
    $$(".rol-btn", $("#registro-roles")).forEach((x) => x.classList.toggle("activo", x.dataset.tipo === "cliente"));
    $("#campo-licencia").classList.add("oculto");
    $("#form-login input[name='usuario']").value = usuario;
  } catch (err) {
    mostrarErrorRegistro(mensajeRed(err));
  }
});

document.addEventListener("click", (e) => {
  const ver = e.target.closest("[data-ver]");
  if (ver) {
    $("#error-login")?.remove();
    $("#error-registro")?.remove();
    mostrarVista(ver.dataset.ver);
  }

  const salir = e.target.closest("[data-salir]");
  if (salir) {
    estado.rol = estado.nombre = estado.usuario = estado.idRef = null;
    estado.pedidos = [];
    detenerTiempoReal();
    $("#form-login").reset();
    mostrarVista("vista-login");
  }
});

/* =========================================================
   ADMIN
   ========================================================= */
function renderAdmin() {
  renderAdminTablaConductores();
  renderAdminTablaPaquetes();
  renderAdminTablaConductoresCrud();
  renderAdminVehiculos();
  llenarSelectsPedido();
}

function llenarSelectsPedido() {
  const cli = $("#form-pedido-admin [name='id_cliente']");
  const cond = $("#form-pedido-admin [name='id_conductor']");
  const veh = $("#form-pedido-admin [name='id_vehiculo']");
  if (!cli || !cond || !veh) return;

  const prevCli = cli.value, prevCond = cond.value, prevVeh = veh.value;

  cli.innerHTML = estado.clientes.map((c) => `<option value="${c.id_cliente}">${esc(c.nombre)}</option>`).join("");
  cond.innerHTML = '<option value="">— Sin asignar —</option>' + estado.conductores
    .map((c) => `<option value="${c.id_conductor}">${esc(c.nombre)}</option>`).join("");
  veh.innerHTML = '<option value="">— Sin asignar —</option>' + estado.vehiculos
    .map((v) => `<option value="${v.id_vehiculo}">${esc(v.tipo)} (${esc(v.placa)})</option>`).join("");

  if (prevCli) cli.value = prevCli;
  if (prevCond) cond.value = prevCond;
  if (prevVeh) veh.value = prevVeh;
}

function renderAdminTablaConductores() {
  const filas = estado.conductores.map((c) => {
    const conectado = leerConexion(c.id_conductor);
    const de = estado.pedidos.filter((p) => p.id_conductor === c.id_conductor);
    const enRuta = de.filter((p) => p.estado === "EN_CAMINO").length;
    const entregados = de.filter((p) => p.estado === "ENTREGADO").length;
    const incidencias = de.filter((p) => p.estado === "INCIDENCIA").length;
    const dot = conectado ? "#2ec4b6" : "#ef4b4b";
    const etiqueta = conectado ? "Conectado" : "Desconectado";

    return `
      <tr>
        <td>
          <div style="display:inline-flex;align-items:center;gap:8px">
            <span style="width:8px;height:8px;border-radius:99px;background:${dot}"></span>
            <b>${esc(c.nombre)}</b>
          </div>
        </td>
        <td><span class="pill" style="color:${conectado ? "#0b8378" : "#c23333"}">${etiqueta}</span></td>
        <td><b>${enRuta}</b></td>
        <td><b>${entregados}</b></td>
        <td><b>${incidencias}</b></td>
        <td><span style="font-size:12px;color:var(--tinta-300)">${esc(c.licencia || "—")}</span></td>
      </tr>`;
  }).join("");

  $("#tabla-conductores").innerHTML = `
    <thead>
      <tr>
        <th>Conductor</th><th>Estado</th><th>En ruta</th>
        <th>Entregados</th><th>Incidencias</th><th>Licencia</th>
      </tr>
    </thead>
    <tbody>${filas || '<tr><td colspan="6"><div class="vacio">No hay conductores registrados.</div></td></tr>'}</tbody>`;
}

function renderAdminTablaConductoresCrud() {
  $("#tabla-conductores-crud").innerHTML = `
    <thead>
      <tr><th>Conductor</th><th>Correo</th><th>Teléfono</th><th>Acciones</th></tr>
    </thead>
    <tbody>${
      estado.conductores.map((c) => `
        <tr>
          <td><b>${esc(c.nombre)}</b></td>
          <td>${esc(c.email || "—")}</td>
          <td>${esc(c.telefono || "—")}</td>
          <td>
            <div style="display:flex;gap:6px">
              <button class="btn" data-accion="editar-conductor" data-id="${esc(c.id_conductor)}">✎ Editar</button>
              <button class="btn-rojo btn" data-accion="eliminar-conductor" data-id="${esc(c.id_conductor)}">Eliminar</button>
            </div>
          </td>
        </tr>`
      ).join("") || '<tr><td colspan="4"><div class="vacio">No hay conductores registrados.</div></td></tr>'
    }</tbody>`;
}

function renderAdminVehiculos() {
  $("#tabla-vehiculos").innerHTML = `
    <thead>
      <tr><th>Placa</th><th>Tipo</th><th>Capacidad</th><th>Acciones</th></tr>
    </thead>
    <tbody>${
      estado.vehiculos.map((v) => `
        <tr>
          <td><b>${esc(v.placa)}</b></td>
          <td>${esc(v.tipo || "—")}</td>
          <td>${esc(v.capacidad || "—")}</td>
          <td>
            <div style="display:flex;gap:6px">
              <button class="btn" data-accion="editar-vehiculo" data-id="${esc(v.id_vehiculo)}">✎ Editar</button>
              <button class="btn-rojo btn" data-accion="eliminar-vehiculo" data-id="${esc(v.id_vehiculo)}">Eliminar</button>
            </div>
          </td>
        </tr>`
      ).join("") || '<tr><td colspan="4"><div class="vacio">No hay vehículos registrados.</div></td></tr>'
    }</tbody>`;
}

function limpiarFormConductor() {
  $("#form-conductor").reset();
  $("#form-conductor [name='id_conductor']").value = "";
  $("#form-conductor button[type='submit']").textContent = "Guardar";
}

function limpiarFormVehiculo() {
  $("#form-vehiculo").reset();
  $("#form-vehiculo [name='id_vehiculo']").value = "";
  $("#form-vehiculo button[type='submit']").textContent = "Guardar";
}

function rellenarFormConductor(c) {
  const f = $("#form-conductor");
  f.reset();
  f.querySelector("[name='id_conductor']").value = c.id_conductor;
  f.querySelector("[name='nombre']").value = c.nombre;
  f.querySelector("[name='licencia']").value = c.licencia;
  f.querySelector("[name='telefono']").value = c.telefono;
  f.querySelector("button[type='submit']").textContent = "Actualizar";
  f.scrollIntoView({ behavior: "smooth", block: "start" });
}

function rellenarFormVehiculo(v) {
  const f = $("#form-vehiculo");
  f.reset();
  f.querySelector("[name='id_vehiculo']").value = v.id_vehiculo;
  f.querySelector("[name='placa']").value = v.placa;
  f.querySelector("[name='tipo']").value = v.tipo;
  f.querySelector("[name='capacidad']").value = v.capacidad;
  f.querySelector("button[type='submit']").textContent = "Actualizar";
  f.scrollIntoView({ behavior: "smooth", block: "start" });
}

function rellenarFormPedido(p) {
  const f = $("#form-pedido-admin");
  const mapa = estado.mapas.admin;
  f.reset();
  f.querySelector("[name='id_pedido']").value = p.id_pedido;
  f.querySelector("[name='id_cliente']").value = p.id_cliente;
  f.querySelector("[name='id_cliente']").dispatchEvent(new Event("change"));
  f.querySelector("[name='id_conductor']").value = p.id_conductor || "";
  f.querySelector("[name='id_vehiculo']").value = p.id_vehiculo || "";
  f.querySelector("[name='direccion']").value = p.direccion;
  f.querySelector("[name='latitud']").value = Number(p.latitud).toFixed(6);
  f.querySelector("[name='longitud']").value = Number(p.longitud).toFixed(6);

  const lat = Number(p.latitud) || COORDS_PIN_DEFAULT[1];
  const lng = Number(p.longitud) || COORDS_PIN_DEFAULT[0];
  if (pinAdmin) pinAdmin.setLngLat([lng, lat]);
  const btn = f.querySelector("button[type='submit']");
  btn.dataset.edicion = "1";
  btn.textContent = "Actualizar Pedido";
  f.scrollIntoView({ behavior: "smooth", block: "start" });
  if (mapa) {
    mapa.flyTo({ center: [lng, lat], zoom: 13, essential: true });
  }
}

function renderAdminTablaPaquetes() {
  const lista = estado.pedidos.slice().sort((a, b) => b.id_pedido - a.id_pedido);
  const conteos = {
    PENDIENTE: lista.filter((p) => p.estado === "PENDIENTE").length,
    ASIGNADO: lista.filter((p) => p.estado === "ASIGNADO").length,
    EN_CAMINO: lista.filter((p) => p.estado === "EN_CAMINO").length,
    ENTREGADO: lista.filter((p) => p.estado === "ENTREGADO").length,
    INCIDENCIA: lista.filter((p) => p.estado === "INCIDENCIA").length,
    CANCELADO: lista.filter((p) => p.estado === "CANCELADO").length,
    sinAsignar: lista.filter((p) => !p.id_conductor).length,
  };

  $("#conteos-admin").innerHTML = `
    ${Object.entries(conteos).map(([k, v]) => {
      const colores = {
        PENDIENTE: "#64748b", ASIGNADO: "#334155", EN_CAMINO: "#f5a623",
        ENTREGADO: "#2ec4b6", INCIDENCIA: "#f36c2e", CANCELADO: "#ef4b4b", sinAsignar: "#94a3b8",
      };
      const labels = {
        PENDIENTE: "pendientes", ASIGNADO: "asignados", EN_CAMINO: "en camino",
        ENTREGADO: "entregados", INCIDENCIA: "incidencias", CANCELADO: "cancelados", sinAsignar: "sin asignar",
      };
      return `<span class="contador"><span class="punto" style="background:${colores[k]}"></span><span>${labels[k]}: <b>${v}</b></span></span>`;
    }).join("")}`;

  const filas = lista.map((p) => {
    const options = ['<option value="">— sin asignar —</option>']
      .concat(estado.conductores.map((c) => `<option value="${c.id_conductor}" ${p.id_conductor === c.id_conductor ? "selected" : ""}>${esc(c.nombre)}</option>`))
      .join("");

    const accionReasignar = (p.estado === "ENTREGADO" || p.estado === "INCIDENCIA") && p.id_conductor
      ? `<button class="btn" data-accion="reasignar" data-id="${esc(p.id_pedido)}">Reasignar</button>` : "";

    return `
      <tr>
        <td><b>#${esc(p.id_pedido)}</b></td>
        <td>${esc(nombreClientePedido(p))}</td>
        <td style="max-width:220px">${esc(p.direccion)}</td>
        <td>${pillEstado(p.estado)}</td>
        <td>
          <select data-accion="asignar" data-id="${esc(p.id_pedido)}" class="select-asignar">${options}</select>
        </td>
        <td>
          <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-start">
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button class="btn" data-accion="editar-pedido" data-id="${esc(p.id_pedido)}">✎ Editar</button>
              ${accionReasignar}
              ${p.id_conductor ? `<button class="btn" data-accion="retirar" data-id="${esc(p.id_pedido)}">Retirar</button>` : ""}
            </div>
          </div>
        </td>
      </tr>`;
  }).join("");

  $("#tabla-paquetes").innerHTML = `
    <thead>
      <tr><th>ID</th><th>Cliente</th><th>Dirección</th><th>Estado</th><th>Asignado a</th><th>Acciones</th></tr>
    </thead>
    <tbody>${filas || '<tr><td colspan="6"><div class="vacio">No hay pedidos.</div></td></tr>'}</tbody>`;
}

/* Delegación de acciones en el panel admin */
$("#panel-admin").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-accion]");
  if (!btn || btn.tagName === "SELECT") return;
  const id = Number(btn.dataset.id);

  if (btn.dataset.accion === "editar-pedido") {
    const p = pedidoPorId(id);
    if (p) rellenarFormPedido(p);
    return;
  }

  if (btn.dataset.accion === "editar-conductor") {
    const c = estado.conductores.find((x) => x.id_conductor === id);
    if (c) rellenarFormConductor(c);
    return;
  }
  if (btn.dataset.accion === "eliminar-conductor") {
    if (!confirm("¿Eliminar este conductor?")) return;
    const c = estado.conductores.find((x) => x.id_conductor === id);
    try {
      await api(`/conductores/${id}`, { method: "DELETE" });
      limpiarFormConductor();
      await cargarDatos();
      renderAdmin();
    } catch (err) { alert(c?.nombre ? `No se pudo eliminar a ${c.nombre}: ${err.message}` : err.message); }
    return;
  }

  if (btn.dataset.accion === "editar-vehiculo") {
    const v = estado.vehiculos.find((x) => x.id_vehiculo === id);
    if (v) rellenarFormVehiculo(v);
    return;
  }
  if (btn.dataset.accion === "eliminar-vehiculo") {
    if (!confirm("¿Eliminar este vehículo?")) return;
    try {
      await api(`/vehiculos/${id}`, { method: "DELETE" });
      limpiarFormVehiculo();
      await cargarDatos();
      renderAdmin();
    } catch (err) { alert(err.message); }
    return;
  }

  const p = pedidoPorId(id);

  try {
    if (btn.dataset.accion === "direccion") {
      const nueva = prompt(`Nueva dirección para #${p.id_pedido}:`, p.direccion);
      if (nueva === null || !String(nueva).trim()) return;
      await api(`/pedidos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cuerpoPedido(p), direccion: String(nueva).trim() }),
      });
    }
    if (btn.dataset.accion === "reasignar") {
      const lista = estado.conductores.map((c, i) => `${i + 1}) ${c.nombre}`).join("\n");
      if (!lista) { alert("No hay conductores registrados."); return; }
      const objetivo = prompt(`Reasignar #${p.id_pedido} a otro conductor:\n${lista}`, "1");
      if (objetivo === null) return;
      const c = estado.conductores[Number(objetivo.trim()) - 1];
      if (!c) { alert("Conductor inválido."); return; }
      await asignarPedido(p, c.id_conductor);
    }
    if (btn.dataset.accion === "retirar") {
      if (!confirm(`¿Retirar #${p.id_pedido} de ${nombreConductor(p.id_conductor)}? Queda sin asignar.`)) return;
      await asignarPedido(p, null);
    }
    await cargarPedidos();
    renderAdmin();
  } catch (err) {
    alert(err.message);
  }
});

$("#form-conductor").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = $("#form-conductor");
  const id = f.querySelector("[name='id_conductor']").value;
  const cuerpo = {
    nombre: String(f.querySelector("[name='nombre']").value).trim(),
    email: String(f.querySelector("[name='email']").value).trim(),
    licencia: String(f.querySelector("[name='licencia']").value).trim(),
    telefono: String(f.querySelector("[name='telefono']").value).trim(),
  };
  if (!cuerpo.nombre || !cuerpo.licencia || !cuerpo.telefono) return alert("Completá nombre, licencia y teléfono.");
  try {
    const res = await api(id ? `/conductores/${id}` : "/conductores", {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { nombre: cuerpo.nombre, licencia: cuerpo.licencia, telefono: cuerpo.telefono, email: cuerpo.email } : cuerpo),
    });
    limpiarFormConductor();
    await cargarDatos();
    renderAdmin();
    if (!id && res && res.username) {
      alert(`Conductor creado con acceso.\n\nUsuario: ${res.username}\nContraseña inicial: 123`);
    }
  } catch (err) {
    alert(err.message);
  }
});

$("#form-vehiculo").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = $("#form-vehiculo");
  const id = f.querySelector("[name='id_vehiculo']").value;
  const cuerpo = {
    placa: String(f.querySelector("[name='placa']").value).trim(),
    tipo: String(f.querySelector("[name='tipo']").value).trim(),
    capacidad: String(f.querySelector("[name='capacidad']").value).trim(),
  };
  if (!cuerpo.placa || !cuerpo.tipo || !cuerpo.capacidad) return alert("Completá placa, tipo y capacidad.");
  try {
    await api(id ? `/vehiculos/${id}` : "/vehiculos", {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    limpiarFormVehiculo();
    await cargarDatos();
    renderAdmin();
  } catch (err) {
    alert(err.message);
  }
});

$("#form-pedido-admin").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = $("#form-pedido-admin");
  const id = f.querySelector("[name='id_pedido']").value;
  const latitud = Number(f.querySelector("[name='latitud']").value);
  const longitud = Number(f.querySelector("[name='longitud']").value);
  const direccion = String(f.querySelector("[name='direccion']").value).trim();
  const id_cliente = Number(f.querySelector("[name='id_cliente']").value);

  if (!id_cliente) return alert("Seleccioná un cliente.");
  if (!direccion) return alert("Marcá la dirección en el mapa o buscá una ubicación.");
  if (!latitud || !longitud) return alert("El punto de entrega no tiene coordenadas. Marcálo en el mapa.");

  const cuerpo = {
    id_cliente,
    direccion,
    latitud,
    longitud,
    id_conductor: f.querySelector("[name='id_conductor']").value ? Number(f.querySelector("[name='id_conductor']").value) : null,
    id_vehiculo: f.querySelector("[name='id_vehiculo']").value ? Number(f.querySelector("[name='id_vehiculo']").value) : null,
    estado: "PENDIENTE",
  };

  try {
    if (id) {
      const prev = pedidoPorId(id);
      if (prev && prev.estado) cuerpo.estado = prev.estado;
      await api(`/pedidos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
    } else {
      await api("/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
    }
    limpiarFormPedido();
    await cargarPedidos();
    renderAdmin();
  } catch (err) {
    alert(err.message);
  }
});

$("#panel-admin").addEventListener("click", (e) => {
  const limpiar = e.target.closest("[data-limpiar]");
  if (!limpiar) return;
  if (limpiar.dataset.limpiar === "conductor") limpiarFormConductor();
  if (limpiar.dataset.limpiar === "vehiculo") limpiarFormVehiculo();
  if (limpiar.dataset.limpiar === "pedido") limpiarFormPedido();
});

$("#tabla-paquetes").addEventListener("change", async (e) => {
  const sel = e.target.closest("select[data-accion='asignar']");
  if (!sel) return;
  const p = pedidoPorId(sel.dataset.id);
  try {
    await asignarPedido(p, sel.value ? Number(sel.value) : null);
    await cargarPedidos();
    renderAdmin();
  } catch (err) {
    alert(err.message);
    renderAdmin();
  }
});

/* =========================================================
   CONDUCTOR
   ========================================================= */
function renderConductor() {
  renderConductorConteos();
  renderConductorRuta();
  renderReporte();
  actualizarBotonConexion();
}

function pedidosDelConductor() {
  return estado.pedidos.filter((p) => p.id_conductor === estado.idRef);
}

function renderConductorConteos() {
  const asignados = pedidosDelConductor();
  const activos = asignados.filter((p) => p.estado !== "CANCELADO" && p.estado !== "INCIDENCIA");
  $("#cd-dia").textContent = activos.length;
  $("#cd-pend").textContent = activos.filter((p) => p.estado === "PENDIENTE" || p.estado === "ASIGNADO").length;
  $("#cd-camino").textContent = activos.filter((p) => p.estado === "EN_CAMINO").length;
  $("#cd-ent").textContent = asignados.filter((p) => p.estado === "ENTREGADO").length;
}

function renderReporte() {
  const asignados = pedidosDelConductor();
  const entregados = asignados.filter((p) => p.estado === "ENTREGADO").length;
  const enRecorrido = asignados.filter((p) => p.estado === "ASIGNADO" || p.estado === "EN_CAMINO").length;
  const incidencias = asignados.filter((p) => p.estado === "INCIDENCIA").length;
  $("#reporte-dia").innerHTML = `
    <p class="mt">Paquetes asignados: <b>${asignados.length}</b> · Entregados: <b>${entregados}</b> · En recorrido: <b>${enRecorrido}</b> · Incidencias: <b>${incidencias}</b></p>`;
}

function actualizarBotonConexion() {
  const btn = $("#btn-conexion");
  const aviso = $("#aviso-conexion");
  if (estado.conectado) {
    btn.textContent = "Conectado";
    btn.className = "btn btn-conectado";
    aviso.classList.add("oculto");
  } else {
    btn.textContent = "Desconectado";
    btn.className = "btn btn-desconectado";
    aviso.classList.remove("oculto");
  }
}

$("#btn-conexion").addEventListener("click", () => {
  estado.conectado = !estado.conectado;
  guardarConexion(estado.idRef, estado.conectado);
  renderConductor();
});

$("#btn-refrescar").addEventListener("click", async () => {
  try {
    await cargarPedidos();
    renderConductor();
  } catch (err) {
    alert(err.message);
  }
});

function renderConductorRuta() {
  const activos = pedidosDelConductor().filter(
    (p) => p.estado !== "CANCELADO" && p.estado !== "INCIDENCIA",
  );
  const lista = $("#lista-ruta");

  if (!activos.length) {
    lista.innerHTML = `
      <div class="vacio">
        <div class="icono">📦</div>
        <h3>Aún no tenés paquetes asignados</h3>
        <p style="font-size:13px;margin-top:6px">El administrador va a asignarte entregas desde su panel.</p>
      </div>`;
    return;
  }

  lista.innerHTML = activos.map((p) => {
    const desconectado = !estado.conectado;
    const entregado = p.estado === "ENTREGADO";

    const botones = entregado
      ? `<button class="btn" data-accion="ver-en-mapa" data-id="${esc(p.id_pedido)}">Ver en mapa</button>`
      : `
        ${p.estado === "PENDIENTE" || p.estado === "ASIGNADO"
          ? `<button class="btn-ambar btn" data-accion="iniciar-viaje" data-id="${esc(p.id_pedido)}" ${desconectado ? "disabled" : ""}>Iniciar viaje</button>`
          : `<button class="btn-verde btn" data-accion="marcar-entregado" data-id="${esc(p.id_pedido)}" ${desconectado ? "disabled" : ""}>Marcar entregado</button>
             <button class="btn" data-accion="no-entregado" data-id="${esc(p.id_pedido)}" ${desconectado ? "disabled" : ""}>No se pudo entregar</button>`}
        <button class="btn" data-accion="ver-en-mapa" data-id="${esc(p.id_pedido)}">Ver en mapa</button>`;

    return `
      <div class="tarjeta-paquete ${p.estado === "EN_CAMINO" ? "destacada" : ""}">
        <div class="tp-cab">
          <span class="tp-id">#${esc(p.id_pedido)}</span>
          ${pillEstado(p.estado)}
        </div>
        <div class="tp-cliente">${esc(nombreClientePedido(p))}</div>
        <div class="tp-texto">📍 ${esc(p.direccion)}</div>
        <div class="tp-acciones">${botones}</div>
      </div>`;
  }).join("");
}

/* Delegación de acciones del conductor */
$("#lista-ruta").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-accion]");
  if (!btn) return;
  const p = pedidoPorId(btn.dataset.id);

  if (btn.dataset.accion === "ver-en-mapa") {
    mostrarEnMapa("conductor", p);
    return;
  }

  try {
    if (btn.dataset.accion === "iniciar-viaje") {
      await cambiarEstado(p, "EN_CAMINO");
    }
    if (btn.dataset.accion === "no-entregado") {
      if (!confirm("¿Marcar como NO entregado? El pedido vuelve a la central para reasignarse.")) return;
      await cambiarEstado(p, "INCIDENCIA");
    }
    if (btn.dataset.accion === "marcar-entregado") {
      if (!confirm(`¿Confirmás la entrega de #${p.id_pedido}?`)) return;
      await cambiarEstado(p, "ENTREGADO");
    }
    await cargarPedidos();
    renderConductor();
  } catch (err) {
    alert(err.message);
  }
});

/* =========================================================
   CLIENTE
   ========================================================= */
function renderCliente() {
  const pedidos = estado.pedidos.filter((p) => p.id_cliente === estado.idRef);
  const conteos = {
    PENDIENTE: pedidos.filter((p) => p.estado === "PENDIENTE").length,
    ASIGNADO: pedidos.filter((p) => p.estado === "ASIGNADO").length,
    EN_CAMINO: pedidos.filter((p) => p.estado === "EN_CAMINO").length,
    ENTREGADO: pedidos.filter((p) => p.estado === "ENTREGADO").length,
    CANCELADO: pedidos.filter((p) => p.estado === "CANCELADO").length,
  };

  $("#conteos-cliente").innerHTML = `
    <span class="contador"><span class="punto" style="background:#64748b"></span><span>pendientes: <b>${conteos.PENDIENTE}</b></span></span>
    <span class="contador"><span class="punto" style="background:#334155"></span><span>asignados: <b>${conteos.ASIGNADO}</b></span></span>
    <span class="contador"><span class="punto" style="background:#f5a623"></span><span>en camino: <b>${conteos.EN_CAMINO}</b></span></span>
    <span class="contador"><span class="punto" style="background:#2ec4b6"></span><span>entregados: <b>${conteos.ENTREGADO}</b></span></span>
    <span class="contador"><span class="punto" style="background:#ef4b4b"></span><span>cancelados: <b>${conteos.CANCELADO}</b></span></span>`;

  const lista = $("#lista-pedidos");
  if (!pedidos.length) {
    lista.innerHTML = `
      <div class="vacio">
        <div class="icono">🧾</div>
        <h3>Todavía no tenés pedidos</h3>
        <p style="font-size:13px;margin-top:6px">Cuando el administrador cargue un paquete a tu nombre, va a aparecer acá.</p>
      </div>`;
    return;
  }

  lista.innerHTML = pedidos.slice().reverse().map((p) => {
    const asignado = p.id_conductor ? esc(nombreConductorPedido(p)) : "en preparación";
    const puedeCancelar = p.estado === "PENDIENTE";

    return `
      <div class="tarjeta-paquete">
        <div class="tp-cab">
          <span class="tp-id">#${esc(p.id_pedido)}</span>
          ${pillEstado(p.estado)}
        </div>
        <div class="tp-texto">📍 ${esc(p.direccion)}</div>
        <div class="tp-texto">🚚 Conductor: <b>${asignado}</b></div>
        <div class="tp-acciones">
          <button class="btn" data-accion="ver-en-mapa" data-id="${esc(p.id_pedido)}">Ver pedido en el mapa</button>
          ${puedeCancelar ? `<button class="btn-rojo btn" data-accion="cancelar" data-id="${esc(p.id_pedido)}">Cancelar pedido</button>` : ""}
        </div>
      </div>`;
  }).join("");
}

$("#lista-pedidos").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-accion]");
  if (!btn) return;
  const p = pedidoPorId(btn.dataset.id);

  if (btn.dataset.accion === "ver-en-mapa") {
    mostrarEnMapa("cliente", p);
    return;
  }

  if (btn.dataset.accion === "cancelar") {
    if (!confirm("¿Cancelar este pedido? Esta acción no se puede deshacer.")) return;
    try {
      await cambiarEstado(p, "CANCELADO");
      await cargarPedidos();
      renderCliente();
    } catch (err) {
      alert(err.message);
    }
  }
});

/* =========================================================
   MAPAS (MapLibre GL — CDN)
   ========================================================= */
const COLOR_TEAL = "#2ec4b6";
const COLOR_AMBER = "#f5a623";
const COLOR_PIN = "#e53e3e";
const CENTRO = [-88.9, 13.7]; // El Salvador
const COORDS_PIN_DEFAULT = [-89.2182, 13.6929]; // San Salvador
let pinAdmin = null;

function pedidosDelMapa(nombre) {
  const filtro = (p) => p.estado !== "CANCELADO" && p.latitud && p.longitud;
  if (estado.rol === "admin") {
    return estado.pedidos.filter(filtro);
  }
  if (estado.rol === "conductor") {
    return estado.pedidos.filter((p) => p.id_conductor === estado.idRef && filtro(p));
  }
  return estado.pedidos.filter((p) => p.id_cliente === estado.idRef && filtro(p));
}

function colorEstado(estado) {
  const colores = {
    PENDIENTE: "#64748b",
    ASIGNADO: "#334155",
    EN_CAMINO: COLOR_AMBER,
    ENTREGADO: COLOR_TEAL,
    INCIDENCIA: "#f36c2e",
    CANCELADO: "#ef4b4b",
  };
  return colores[estado] || COLOR_AMBER;
}

const marcadores = { admin: [], conductor: [], cliente: [] };

function dibujarGeolocalizaciones(nombre) {
  for (const m of marcadores[nombre]) m.remove();
  marcadores[nombre] = [];

  const mapa = estado.mapas[nombre];
  if (!mapa) return;

  for (const p of pedidosDelMapa(nombre)) {
    const etiqueta = (ESTADO_META[p.estado] || {}).etiqueta || p.estado;
    const popup = new maplibregl.Popup({ offset: 26, closeButton: false })
      .setHTML(
        `<b>#${esc(p.id_pedido)} · ${esc(nombreClientePedido(p))}</b>` +
        `<br/><span style="font-size:11px">${esc(etiqueta)} · ${esc(p.direccion)}</span>`
      );
    const marker = new maplibregl.Marker({ color: colorEstado(p.estado) })
      .setLngLat([p.longitud, p.latitud])
      .setPopup(popup)
      .addTo(mapa);
    marcadores[nombre].push(marker);
  }
}

function encuadrarGeolocalizaciones(nombre) {
  const mapa = estado.mapas[nombre];
  if (!mapa) return;
  const conCoordenadas = pedidosDelMapa(nombre);
  if (!conCoordenadas.length) return;

  if (conCoordenadas.length === 1) {
    mapa.setCenter([conCoordenadas[0].longitud, conCoordenadas[0].latitud]);
    mapa.setZoom(12);
    return;
  }
  const bounds = new maplibregl.LngLatBounds();
  for (const p of conCoordenadas) bounds.extend([p.longitud, p.latitud]);
  mapa.fitBounds(bounds, { padding: 48, maxZoom: 13 });
}

function refrescarGeolocalizaciones() {
  for (const nombre of ["admin", "conductor", "cliente"]) {
    if (estado.mapas[nombre]) dibujarGeolocalizaciones(nombre);
  }
}

function obtenerMapa(nombre) {
  if (estado.mapas[nombre]) return Promise.resolve(estado.mapas[nombre]);
  return new Promise((resolver) => {
    const div = $("#mapa-" + nombre);
    const mapa = new maplibregl.Map({
      container: div,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: CENTRO,
      zoom: 7,
    });
    mapa.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapa.on("load", () => {
      estado.mapas[nombre] = mapa;
      if (nombre === "admin") prepararPinAdmin();
      dibujarGeolocalizaciones(nombre);
      encuadrarGeolocalizaciones(nombre);
      resolver(mapa);
    });
  });
}

/* ---------------- Pin de registro de pedido (admin) ---------------- */
function prepararPinAdmin() {
  const mapa = estado.mapas.admin;
  if (!mapa) return;

  pinAdmin = new maplibregl.Marker({ color: COLOR_PIN, draggable: true })
    .setLngLat(COORDS_PIN_DEFAULT)
    .addTo(mapa);

  const actualizarDesdePin = () => {
    const { lat, lng } = pinAdmin.getLngLat();
    actualizarCoordenadasPedido(lat, lng);
  };

  pinAdmin.on("dragend", actualizarDesdePin);
  mapa.on("click", (e) => {
    const { lat, lng } = e.lngLat;
    pinAdmin.setLngLat([lng, lat]);
    actualizarCoordenadasPedido(lat, lng);
  });

  actualizarCoordenadasPedido(COORDS_PIN_DEFAULT[1], COORDS_PIN_DEFAULT[0]);
}

async function actualizarCoordenadasPedido(lat, lng) {
  const f = $("#form-pedido-admin");
  if (!f) return;
  f.querySelector("[name='latitud']").value = Number(lat).toFixed(6);
  f.querySelector("[name='longitud']").value = Number(lng).toFixed(6);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      { headers: { "Accept-Language": "es" } }
    );
    const data = await res.json();
    if (data && data.display_name) {
      f.querySelector("[name='direccion']").value = data.display_name;
    }
  } catch {
    f.querySelector("[name='direccion']").value = `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
  }
}

function limpiarFormPedido() {
  const f = $("#form-pedido-admin");
  if (!f) return;
  f.reset();
  f.querySelector("[name='id_cliente']").selectedIndex = 0;
  f.querySelector("[name='id_conductor']").selectedIndex = 0;
  f.querySelector("[name='id_vehiculo']").selectedIndex = 0;
  const btn = f.querySelector("button[type='submit']");
  delete btn.dataset.edicion;
  btn.textContent = "Guardar Pedido";
  if (pinAdmin) pinAdmin.setLngLat(COORDS_PIN_DEFAULT);
  actualizarCoordenadasPedido(COORDS_PIN_DEFAULT[1], COORDS_PIN_DEFAULT[0]);
}

let marcadorActual = null;

function ponerMarcadorTemporal(mapa, { lat, lon, titulo, subtitulo, color }) {
  if (marcadorActual) marcadorActual.remove();
  const popup = new maplibregl.Popup({ offset: 26, closeButton: false })
    .setHTML(`<b>${esc(titulo)}</b>${subtitulo ? `<br/><span style="font-size:11px">${esc(subtitulo)}</span>` : ""}`);
  marcadorActual = new maplibregl.Marker({ color })
    .setLngLat([lon, lat])
    .setPopup(popup)
    .addTo(mapa);
  mapa.flyTo({ center: [lon, lat], zoom: 13, essential: true });
}

async function geocodificar(texto) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=sv&q=${encodeURIComponent(texto)}`;
  const res = await fetch(url, { headers: { "Accept-Language": "es" } });
  const datos = await res.json();
  if (!datos.length) throw new Error("No se encontró la dirección en El Salvador.");
  return { lat: parseFloat(datos[0].lat), lon: parseFloat(datos[0].lon), label: datos[0].display_name };
}

async function mostrarEnMapa(nombre, p) {
  const destino = $("#mensaje-" + nombre);
  const meta = ESTADO_META[p.estado];
  const color = p.estado === "ENTREGADO" ? COLOR_TEAL : COLOR_AMBER;
  const titulo = `#${p.id_pedido} · ${nombreClientePedido(p)}`;
  const subtitulo = `Estado: ${meta ? meta.etiqueta : p.estado} · ${p.direccion}`;
  try {
    destino.textContent = "Buscando ubicación…";
    const mapa = await obtenerMapa(nombre);

    // como antes: ubicar el pedido geocodificando la dirección escrita
    let lat = p.latitud || 0;
    let lon = p.longitud || 0;
    let etiqueta = "";
    if (!lat && !lon) {
      const geo = await geocodificar(p.direccion);
      lat = geo.lat;
      lon = geo.lon;
      etiqueta = geo.label;
    }

    ponerMarcadorTemporal(mapa, { lat, lon, titulo, subtitulo, color });
    destino.textContent = etiqueta || `#${p.id_pedido}: ${p.direccion}`;
  } catch {
    destino.textContent = "No pudimos geocodificar esa dirección. Probá buscarla manualmente.";
  }
}

function enlazarBuscadores() {
  const formularios = [
    { form: "#form-buscar-admin", input: "#buscar-admin", nombre: "admin" },
    { form: "#form-buscar-conductor", input: "#buscar-conductor", nombre: "conductor" },
    { form: "#form-buscar-cliente", input: "#buscar-cliente", nombre: "cliente" },
  ];
  for (const { form, input, nombre } of formularios) {
    $(form).addEventListener("submit", async (e) => {
      e.preventDefault();
      const texto = String($(input).value).trim();
      const destino = $("#mensaje-" + nombre);
      if (!texto) return;
      destino.textContent = "Buscando…";
      try {
        const mapa = await obtenerMapa(nombre);
        const geo = await geocodificar(texto);
        if (nombre === "admin") {
          if (pinAdmin) pinAdmin.setLngLat([geo.lon, geo.lat]);
          actualizarCoordenadasPedido(geo.lat, geo.lon);
        }
        ponerMarcadorTemporal(mapa, { lat: geo.lat, lon: geo.lon, titulo: "Ubicación buscada", subtitulo: texto });
        destino.textContent = geo.label;
      } catch {
        destino.textContent = `No encontramos “${texto}” en El Salvador. Probá con otra búsqueda o un pedido.`;
      }
    });
  }
}

/* =========================================================
   Arranque
   ========================================================= */
enlazarRolTabs();
enlazarBuscadores();
document.querySelector('#form-registro input[name="nombre"]')?.focus();

// prueba OpenCode
