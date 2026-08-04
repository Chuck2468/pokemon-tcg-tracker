import { auth } from "./auth.js";
import { storage } from "./cardRepository.js";
import { TYPE_COLORS,TYPE_SOFT,TYPES,VARIANTS } from "./constants.js";
import { COLLECTIONS } from "./data/collections.js";
import { userRepository } from "./userRepository.js";

const INVENTORY_ID = "inventory";

let state = {
  activeId: COLLECTIONS[0].id,
  cache: {},           // collectionId -> array of cards, or undefined if not loaded yet
  search: "",
  activeType: "ALL",
  activeStatus: "ALL",
  onlyFullArt: false,   // filtro exclusivo del Inventario
  saveError: false,

  user: null
};

// Guards against handling the same session twice (e.g. an explicit getSession()
// check racing with the SIGNED_IN/INITIAL_SESSION event for the same session).
let handledSessionId = null;

async function handleSession(session) {
  if (!session) {
    handledSessionId = null;
    state.user = null;
    renderLogin();
    return;
  }
  // Limpiar los parámetros OAuth de la URL
  if (window.location.search || window.location.hash) {
    history.replaceState(
      {},
      document.title,
      window.location.pathname
    );
  }
  // Evitar procesar dos veces la misma sesión
  if (session.access_token === handledSessionId) return;
  handledSessionId = session.access_token;
  const user = await auth.getUser();
  const role = await userRepository.getRole(user.id);
  if (!role) {
    state.user = null;
    renderUnauthorized();
    return;
  }
  state.user = {
    id: user.id,
    role,
    name:
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email,
    email: user.email
  };
  // Los viewers no tienen acceso al listado de colecciones, así que
  // siempre aterrizan en el Inventario en vez de en la primera colección.
  if (role !== "admin") {
    state.activeId = INVENTORY_ID;
  }
  await startApp();
}

// Drives the app off Supabase's own auth events instead of a one-shot
// getSession() check on script load. onAuthStateChange only fires SIGNED_IN
// once the client has fully finished processing the OAuth redirect (parsing
// the URL, exchanging the code, and persisting the session) - checking
// getSession() synchronously on load can race with that and briefly return
// null right after a valid login, bouncing the user back to the login screen.
auth.onAuthChange((_event, session) => {
  handleSession(session);
});

// Fallback for a normal page load where a session is already persisted
// (no OAuth redirect just happened). handleSession() is safe to call twice
// thanks to the handledSessionId guard above.
auth.getSession().then(handleSession);

const root = document.getElementById("root");

function escapeHtml(str){
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function getMeta(id){
  return COLLECTIONS.find(c => c.id === id) || COLLECTIONS[0];
}

// Una colección "compuesta" (p.ej. Black Star Promos) no tiene seed propio:
// agrupa varias subcolecciones (MEP, SVP...) que sí lo tienen.
function isComposite(meta){
  return !!(meta && meta.subcollections);
}

// Lista plana de todas las unidades cargables/almacenables: las colecciones
// normales tal cual, y las subcolecciones de las compuestas. Se usa para
// cargar datos, comprobar si todo está cargado, y para agrupar el Inventario.
function leafCollections(){
  return COLLECTIONS.flatMap(c => isComposite(c) ? c.subcollections : [c]);
}

function findLeafMeta(id){
  return leafCollections().find(c => c.id === id) || null;
}

function toVariantCard(raw){
  // Migrates old {cantidad} shape or fills in a fresh {variantes} shape
  if(raw.variantes){
    return raw;
  }
  return {
    id: raw.id,
    nombre: raw.nombre,
    tipo: raw.tipo,
    numero: raw.numero,
    set: raw.set,
    variantes: {
      normal: raw.cantidad || 0,
      reverse: 0,
      holo: 0,
      fullart: 0
    }
  };
}

function cardTotal(card){
  return VARIANTS.reduce((s,v) => s + (card.variantes[v.key] || 0), 0);
}

// Las cartas del Set de Juego (id <= gameSetMax) solo pueden ser Normal/Reverse/Holo.
// Las cartas exclusivas del Set Maestro (más allá del Set de Juego) son siempre FullArt.
// Si por algún motivo hay stock cargado en una variante "no esperada", se sigue mostrando
// para no ocultar datos reales.
function applicableVariants(card, gameSetMax){
  // gameSetMax === null: colección sin distinción Play Set / Master Set
  // (p.ej. Black Star Promos), se muestran siempre las 4 variantes.
  if(gameSetMax === null){
    return VARIANTS;
  }
  const isBaseSet = parseInt(card.id, 10) <= gameSetMax;
  return VARIANTS.filter(v => {
    const expected = isBaseSet ? v.key !== "fullart" : v.key === "fullart";
    const hasStock = (card.variantes[v.key] || 0) > 0;
    return expected || hasStock;
  });
}

async function loadCollectionData(id) {
  const meta = findLeafMeta(id);
  if(!meta) return;
  // Cartas base de la colección (nombre, tipo, número, etc.)
  const seedCards = meta.seed.map(toVariantCard);
  try {
    // Stock almacenado en Supabase
    const rows = await storage.getCollection(id);
    // Índice por card_id para acceder rápidamente
    const stock = new Map(
      rows.map(row => [row.card_id, row])
    );
    // Mezclar datos estáticos con el stock
    const cards = seedCards.map(card => {
      const row = stock.get(card.id);
      if (!row) return card;
      return {
        ...card,
        variantes: {
          normal: row.normal,
          reverse: row.reverse,
          holo: row.holo,
          fullart: row.fullart
        }
      };
    });
    state.cache[id] = cards;
  } catch (error) {
    console.error(error);
    // Si falla Supabase, cargar al menos la colección vacía
    state.cache[id] = seedCards;
  }
}

async function loadCollection(id) {
  await loadCollectionData(id);
  render();
}

// Precarga en Supabase, a valor 0, las cartas de una colección (o
// subcolección) que aún no tengan fila propia. No toca las que ya existen,
// así que es seguro pulsar el botón varias veces sin perder stock ya
// guardado. Devuelve cuántas filas nuevas se han creado.
async function initializeCollection(id){
  const meta = findLeafMeta(id);
  if(!meta) return {created: 0, total: 0};
  const rows = await storage.getCollection(id);
  const existing = new Set(rows.map(row => row.card_id));
  const seedCards = meta.seed.map(toVariantCard);
  const missing = seedCards.filter(c => !existing.has(c.id));
  await Promise.all(missing.map(c => storage.saveCard(id, c)));
  return {created: missing.length, total: seedCards.length};
}

// Sincroniza una colección concreta: si es una colección normal, inicializa
// esa; si es compuesta (Black Star Promos), inicializa todas sus
// subcolecciones. Devuelve cuántas filas nuevas se han creado en Supabase.
async function syncCollection(id){
  const meta = COLLECTIONS.find(c => c.id === id);
  const leafIds = meta && isComposite(meta) ? meta.subcollections.map(s => s.id) : [id];

  const results = await Promise.all(leafIds.map(lid => initializeCollection(lid)));
  leafIds.forEach(lid => { state.cache[lid] = undefined; });
  await Promise.all(leafIds.map(lid => loadCollectionData(lid)));

  return results.reduce((s, r) => s + r.created, 0);
}

// Sincroniza absolutamente todas las colecciones (todas las hojas: normales
// + subcolecciones de las compuestas).
async function syncAllCollections(){
  const leafIds = leafCollections().map(c => c.id);

  const results = await Promise.all(leafIds.map(lid => initializeCollection(lid)));
  leafIds.forEach(lid => { state.cache[lid] = undefined; });
  await Promise.all(leafIds.map(lid => loadCollectionData(lid)));

  return results.reduce((s, r) => s + r.created, 0);
}

// Handler compartido por los botones "Sync" / "Sync All" del panel de
// usuario. syncFn es syncCollection(id) o syncAllCollections según el botón.
async function handleSyncClick(btn, syncFn){
  if(!btn) return;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Sincronizando…";

  try {
    const totalCreated = await syncFn();
    alert(
      totalCreated > 0
        ? `Listo: ${totalCreated} carta(s) nueva(s) sincronizada(s) en Supabase.`
        : "Todo estaba ya sincronizado en Supabase."
    );
  } catch (error) {
    console.error(error);
    alert("Hubo un error al sincronizar. Revisa la consola.");
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }

  render();
}

function allCollectionsLoaded(){
  return leafCollections().every(c => state.cache[c.id] !== undefined);
}

async function loadAllCollections(){
  const missing = leafCollections().filter(c => state.cache[c.id] === undefined);
  await Promise.all(missing.map(c => loadCollectionData(c.id)));
  render();
}

function selectCollection(id){
  if(id === state.activeId) return;
  // Los viewers no pueden navegar a colecciones individuales, solo al Inventario.
  if(id !== INVENTORY_ID && state.user?.role !== "admin") return;

  state.activeId = id;
  state.search = "";
  state.activeType = "ALL";
  state.activeStatus = "ALL";
  state.onlyFullArt = false;

  if(id === INVENTORY_ID){
    if(!allCollectionsLoaded()){
      render();
      loadAllCollections();
    } else {
      render();
    }
    return;
  }

  const meta = getMeta(id);
  if(isComposite(meta)){
    const missing = meta.subcollections.filter(s => state.cache[s.id] === undefined);
    if(missing.length){
      render();
      Promise.all(missing.map(s => loadCollectionData(s.id))).then(render);
    } else {
      render();
    }
    return;
  }

  if(state.cache[id] === undefined){
    render();
    loadCollection(id);
  } else {
    render();
  }
}

async function changeVariant(collectionId, id, variantKey, delta){
  const cards = state.cache[collectionId];
  if(!cards) return;
  const card = cards.find(c => c.id === id);
  if(!card) return;
  card.variantes[variantKey] = Math.max(0, (card.variantes[variantKey] || 0) + delta);
  await storage.saveCard(collectionId, card);
  render();
}

function filteredCards(){
  let list = state.cache[state.activeId] || [];
  if(state.activeStatus === "PENDING"){
    list = list.filter(c => cardTotal(c) === 0);
  }
  if(state.activeType !== "ALL"){
    list = list.filter(c => c.tipo === state.activeType);
  }
  if(state.search.trim()){
    const q = state.search.trim().toLowerCase();
    list = list.filter(c =>
      c.nombre.toLowerCase().includes(q) ||
      c.numero.toLowerCase().includes(q)
    );
  }
  return list;
}

function computeStats(maxId){
  const cards = state.cache[state.activeId] || [];
  const subset = maxId
    ? cards.filter(c => parseInt(c.id, 10) <= maxId)
    : cards;
  const total = subset.length;
  const owned = subset.filter(c => cardTotal(c) > 0).length;
  const copies = subset.reduce((s,c) => s + cardTotal(c), 0);
  const pct = total ? Math.round((owned/total)*100) : 0;
  return {total, owned, copies, pct};
}

function buildProgressHtml(pct){
  return `<div class="progress-seg" style="width:${pct}%; background:var(--electric-blue);"></div>`;
}

function splitCollectionName(name){
  const m = name.match(/^(.*)\s\[([^\]]+)\]$/);
  if(m) return {title: m[1], abbr: `[${m[2]}]`};
  return {title: name, abbr: ""};
}

function buildSidebarHtml(){
  const isAdmin = state.user?.role === "admin";

  const inventoryItem = `
    <div class="sidebar-item sidebar-item-inventory ${state.activeId === INVENTORY_ID ? "active" : ""}" data-collection="${INVENTORY_ID}">
      <span class="sidebar-dot" style="--item-color:var(--electric-blue)"></span>
      <span class="sidebar-name">
        <span class="sidebar-name-title">Inventario</span>
      </span>
    </div>`;

  // Los viewers solo ven el Inventario: sin listado de colecciones ni botones de edición.
  if(!isAdmin){
    return `
    <div class="sidebar">
      ${inventoryItem}
    </div>`;
  }

  const items = COLLECTIONS.map(c => {
    const {title, abbr} = splitCollectionName(c.name);
    return `
    <div class="sidebar-item ${c.id === state.activeId ? "active" : ""}" data-collection="${c.id}">
      <span class="sidebar-dot" style="--item-color:${c.accent}"></span>
      <span class="sidebar-name">
        <span class="sidebar-name-title">${escapeHtml(title)}</span>
        ${abbr ? `<span class="sidebar-name-abbr">${escapeHtml(abbr)}</span>` : ""}
      </span>
    </div>`;
  }).join("");
  return `
    <div class="sidebar">
      ${inventoryItem}
      <div class="sidebar-title">Colecciones</div>
      ${items}
      <div class="sidebar-hint">Cuando tengas la lista de otra colección, pásamela y la añado aquí.</div>
    </div>`;
}

function renderLogin() {
  root.innerHTML = `
    <div class="shell">
      <div class="main">
        <div class="wrap" style="text-align:center; padding-top:100px;">
          <h1>Pokémon TCG Tracker</h1>
          <p>Inicia sesión para acceder a tu colección.</p>
          <button id="loginBtn" class="google-btn" type="button">
            <svg class="google-icon" viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.9-2.26 5.36-4.78 7.02l7.73 6c4.51-4.18 7.09-10.36 7.09-17.49z"/>
              <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            <span>Continuar con Google</span>
          </button>
        </div>
      </div>
    </div>
  `;
  document
    .getElementById("loginBtn")
    .addEventListener("click", () => auth.login());
}

function renderUnauthorized() {
  root.innerHTML = `
    <div class="shell">
      <div class="main">
        <div class="wrap" style="text-align:center; padding-top:100px;">
          <h1>Acceso no autorizado</h1>
          <p>
            Tu cuenta de Google ha iniciado sesión correctamente,
            pero no tiene permisos para utilizar esta aplicación.
          </p>
          <button id="logoutBtn">Cerrar sesión</button>
        </div>
      </div>
    </div>
  `;

  document
    .getElementById("logoutBtn")
    .addEventListener("click", async () => {
      await auth.logout();
      location.reload();
    });
}

function buildUserPanelHtml(collectionId){
  if(!state.user) return "";
  const roleName = state.user.role === "admin" ? "Administrador" : "Consulta";
  const isAdmin = state.user.role === "admin";

  const syncActionsHtml = (isAdmin && collectionId) ? `
    <div class="sync-actions">
      <button id="syncBtn" class="sync-btn" data-collection="${collectionId}">Sync</button>
      <button id="syncAllBtn" class="sync-btn">Sync All</button>
    </div>` : "";

  return `
   <div class="user-panel">
     ${syncActionsHtml}
     <div class="user-name">👤 ${escapeHtml(state.user.name)}</div>
     <div class="user-role">${roleName}</div>
     <button id="logoutBtn" class="logout-btn">Cerrar sesión</button>
   </div>
  `;
}

function render(){
  const sidebarHtml = buildSidebarHtml();

  if(state.activeId === INVENTORY_ID){
    renderInventory(sidebarHtml);
    return;
  }

  const meta = getMeta(state.activeId);

  if(isComposite(meta)){
    renderBsp(sidebarHtml, meta);
    return;
  }

  if(state.cache[state.activeId] === undefined){
    root.innerHTML = `
    <div class="shell">
      ${sidebarHtml}
      <div class="main"><div class="loading">Cargando colección…</div></div>
    </div>`;
    attachEvents();
    return;
  }

  const juego = computeStats(meta.gameSetMax);
  const maestro = computeStats();
  const list = filteredCards();
  const editable = state.user?.role === "admin";
  const progressJuegoHtml = buildProgressHtml(juego.pct);
  const progressMaestroHtml = buildProgressHtml(maestro.pct);

  const userInfoHtml = buildUserPanelHtml(state.activeId);

  const statusChipsHtml = ["ALL", "PENDING"].map(s => {
    const label = s === "ALL" ? "Todas" : "Pendientes";
    const active = state.activeStatus === s;
    const color = s === "ALL" ? "var(--ink)" : "var(--pending)";
    return `<div class="chip ${active ? "active" : ""}" data-status="${s}"
      style="${active ? `background:${color};` : ""}">${escapeHtml(label)}</div>`;
  }).join("");

  const typeChipsHtml = ["ALL", ...TYPES].map(t => {
    const label = t === "ALL" ? "Todos los tipos" : t;
    const active = state.activeType === t;
    const color = t === "ALL" ? "var(--ink)" : TYPE_COLORS[t];
    return `<div class="chip ${active ? "active" : ""}" data-type="${t}"
      style="${active ? `background:${color};` : ""}">${escapeHtml(label)}</div>`;
  }).join("");

  const rowsHtml = list.length ? list.map(c => {
    const color = TYPE_COLORS[c.tipo] || "var(--poke)";
    const total = cardTotal(c);
    const variantsHtml = applicableVariants(c, meta.gameSetMax).map(v => `
      <div class="variant-badge" style="--variant-color:${v.color}">
        <div class="vrow">
          <button class="vbtn" data-action="dec" data-collection="${state.activeId}" data-id="${c.id}" data-variant="${v.key}"  ${editable ? "" : "disabled"}>−</button>
          <span class="vcount">${c.variantes[v.key] || 0}</span>
          <button class="vbtn" data-action="inc" data-collection="${state.activeId}" data-id="${c.id}" data-variant="${v.key}"  ${editable ? "" : "disabled"}>+</button>
        </div>
        <span class="lbl">${v.name}</span>
      </div>`).join("");
    return `
    <div class="card-row ${total === 0 ? "zero" : ""}" style="--type-color:${color}">
      <div class="num-badge">${escapeHtml(c.numero)}</div>
      <div class="card-info">
        <div class="card-name">${escapeHtml(c.nombre)}</div>
        <div class="card-type">${escapeHtml(c.tipo)}</div>
      </div>
      ${variantsHtml}
      <div class="total-badge">${total}<span class="lbl">Total</span></div>
    </div>`;
  }).join("") : `
    <div class="empty-state">
      <div class="glyph">🔍</div>
      <p>No hay cartas que coincidan con la búsqueda.</p>
    </div>`;

  root.innerHTML = `
  <div class="shell">
    ${sidebarHtml}
    <div class="main">
    <div class="wrap">

      ${userInfoHtml}

      <div class="header">
        <div class="title-block">
          <div class="eyebrow">${escapeHtml(meta.eyebrow)}</div>
          <h1><span style="color:${meta.accent}">${escapeHtml(meta.name)}</span></h1>
        </div>
        <div class="stats">
          <div class="stat-pill"><span class="num">${maestro.copies}</span><span class="lbl">Copias</span></div>
          <div class="stat-pill"><span class="num">${juego.pct}%</span><span class="lbl">Play Set</span></div>
          <div class="stat-pill"><span class="num">${maestro.pct}%</span><span class="lbl">Master Set</span></div>
        </div>
      </div>

      <div class="progress-strip">
        <div class="row"><span>Play Set (001–${String(meta.gameSetMax).padStart(3,"0")})</span><span>${juego.owned} de ${juego.total} obtenidas · ${juego.pct}%</span></div>
        <div class="progress-track">${progressJuegoHtml}</div>
      </div>

      <div class="progress-strip">
        <div class="row"><span>Master Set (001–${String(maestro.total).padStart(3,"0")})</span><span>${maestro.owned} de ${maestro.total} obtenidas · ${maestro.pct}%</span></div>
        <div class="progress-track">${progressMaestroHtml}</div>
      </div>

      <div class="toolbar">
        <div class="search-box">
          <input type="text" id="searchInput" placeholder="Buscar por nombre o número…" value="${escapeHtml(state.search)}">
        </div>
      </div>

      <div class="chips">${statusChipsHtml}</div>
      <div class="chips">${typeChipsHtml}</div>

      <div class="list">${rowsHtml}</div>

    </div>
    </div>
  </div>`;

  attachEvents();
}

function renderInventory(sidebarHtml){
  if(!allCollectionsLoaded()){
    root.innerHTML = `
    <div class="shell">
      ${sidebarHtml}
      <div class="main"><div class="loading">Cargando inventario…</div></div>
    </div>`;
    attachEvents();
    return;
  }

  const userInfoHtml = buildUserPanelHtml();

  const typeChipsHtml = ["ALL", ...TYPES].map(t => {
    const label = t === "ALL" ? "Todos los tipos" : t;
    const active = state.activeType === t;
    const color = t === "ALL" ? "var(--ink)" : TYPE_COLORS[t];
    return `<div class="chip ${active ? "active" : ""}" data-type="${t}"
      style="${active ? `background:${color};` : ""}">${escapeHtml(label)}</div>`;
  }).join("");

  const fullArtChipHtml = `<div class="chip ${state.onlyFullArt ? "active" : ""}" id="fullArtToggle"
    style="${state.onlyFullArt ? `background:var(--v-fullart);` : ""}">Solo FullArt</div>`;

  const q = state.search.trim().toLowerCase();

  const groups = leafCollections().map(meta => {
    let cards = (state.cache[meta.id] || []).filter(card => cardTotal(card) > 0);
    if(state.activeType !== "ALL"){
      cards = cards.filter(card => card.tipo === state.activeType);
    }
    if(state.onlyFullArt){
      cards = cards.filter(card => (card.variantes.fullart || 0) > 0);
    }
    if(q){
      cards = cards.filter(card =>
        card.nombre.toLowerCase().includes(q) ||
        card.numero.toLowerCase().includes(q)
      );
    }
    return {meta, cards};
  }).filter(g => g.cards.length > 0);

  const totalCards = groups.reduce((s,g) => s + g.cards.length, 0);
  const totalCopies = groups.reduce((s,g) => s + g.cards.reduce((s2,c) => s2 + cardTotal(c), 0), 0);

  // Inventario: solo lectura, sin botones +/- en ningún caso (independientemente del rol).
  const groupsHtml = groups.length ? groups.map(g => {
    const {title, abbr} = splitCollectionName(g.meta.name);
    const rows = g.cards.map(c => {
      const color = TYPE_COLORS[c.tipo] || "var(--poke)";
      const total = cardTotal(c);
      const variantsHtml = applicableVariants(c, g.meta.gameSetMax).map(v => `
        <div class="variant-badge readonly" style="--variant-color:${v.color}">
          <div class="vrow">
            <span class="vcount">${c.variantes[v.key] || 0}</span>
          </div>
          <span class="lbl">${v.name}</span>
        </div>`).join("");
      return `
      <div class="card-row" style="--type-color:${color}">
        <div class="num-badge">${escapeHtml(c.numero)}</div>
        <div class="card-info">
          <div class="card-name">${escapeHtml(c.nombre)}</div>
          <div class="card-type">${escapeHtml(c.tipo)}</div>
        </div>
        ${variantsHtml}
        <div class="total-badge">${total}<span class="lbl">Total</span></div>
      </div>`;
    }).join("");
    return `
    <div class="inventory-group">
      <div class="inventory-group-title">
        <span class="sidebar-dot" style="--item-color:${g.meta.accent}"></span>
        ${escapeHtml(title)}${abbr ? ` <span class="inventory-group-abbr">${escapeHtml(abbr)}</span>` : ""}
      </div>
      <div class="list">${rows}</div>
    </div>`;
  }).join("") : `
    <div class="empty-state">
      <div class="glyph">🔍</div>
      <p>No hay cartas que coincidan con la búsqueda.</p>
    </div>`;

  root.innerHTML = `
  <div class="shell">
    ${sidebarHtml}
    <div class="main">
    <div class="wrap">

      ${userInfoHtml}

      <div class="header">
        <div class="title-block">
          <div class="eyebrow">Todas las colecciones</div>
          <h1>Mi <span style="color:var(--electric-blue)">Inventario</span></h1>
        </div>
        <div class="stats">
          <div class="stat-pill"><span class="num">${totalCards}</span><span class="lbl">Cartas</span></div>
          <div class="stat-pill"><span class="num">${totalCopies}</span><span class="lbl">Copias</span></div>
        </div>
      </div>

      <div class="toolbar">
        <div class="search-box">
          <input type="text" id="searchInput" placeholder="Buscar por nombre o número…" value="${escapeHtml(state.search)}">
        </div>
      </div>

      <div class="chips">${typeChipsHtml}</div>
      <div class="chips">${fullArtChipHtml}</div>

      ${groupsHtml}

    </div>
    </div>
  </div>`;

  attachEvents();
}

// Editor de stock para una colección compuesta (p.ej. Black Star Promos):
// como es una agrupación de varias tandas de promos y no un set real, no
// tiene sentido un % de Play Set / Master Set, así que solo se muestran
// totales. Por lo demás es editable igual que una colección normal, pero
// separada visualmente por subcolección (una por temporada).
function renderBsp(sidebarHtml, meta){
  const subMetas = meta.subcollections;
  const loaded = subMetas.every(s => state.cache[s.id] !== undefined);

  if(!loaded){
    root.innerHTML = `
    <div class="shell">
      ${sidebarHtml}
      <div class="main"><div class="loading">Cargando colección…</div></div>
    </div>`;
    attachEvents();
    return;
  }

  const editable = state.user?.role === "admin";
  const userInfoHtml = buildUserPanelHtml(meta.id);

  const statusChipsHtml = ["ALL", "PENDING"].map(s => {
    const label = s === "ALL" ? "Todas" : "Pendientes";
    const active = state.activeStatus === s;
    const color = s === "ALL" ? "var(--ink)" : "var(--pending)";
    return `<div class="chip ${active ? "active" : ""}" data-status="${s}"
      style="${active ? `background:${color};` : ""}">${escapeHtml(label)}</div>`;
  }).join("");

  const typeChipsHtml = ["ALL", ...TYPES].map(t => {
    const label = t === "ALL" ? "Todos los tipos" : t;
    const active = state.activeType === t;
    const color = t === "ALL" ? "var(--ink)" : TYPE_COLORS[t];
    return `<div class="chip ${active ? "active" : ""}" data-type="${t}"
      style="${active ? `background:${color};` : ""}">${escapeHtml(label)}</div>`;
  }).join("");

  const q = state.search.trim().toLowerCase();

  const groups = subMetas.map(sub => {
    let cards = state.cache[sub.id] || [];
    if(state.activeStatus === "PENDING"){
      cards = cards.filter(c => cardTotal(c) === 0);
    }
    if(state.activeType !== "ALL"){
      cards = cards.filter(c => c.tipo === state.activeType);
    }
    if(q){
      cards = cards.filter(c =>
        c.nombre.toLowerCase().includes(q) ||
        c.numero.toLowerCase().includes(q)
      );
    }
    return {sub, cards};
  });

  const totalCards = groups.reduce((s,g) => s + g.cards.length, 0);
  const totalCopies = groups.reduce((s,g) => s + g.cards.reduce((s2,c) => s2 + cardTotal(c), 0), 0);

  const groupsHtml = groups.map(g => {
    const rows = g.cards.length ? g.cards.map(c => {
      const color = TYPE_COLORS[c.tipo] || "var(--poke)";
      const total = cardTotal(c);
      const variantsHtml = applicableVariants(c, g.sub.gameSetMax).map(v => `
        <div class="variant-badge" style="--variant-color:${v.color}">
          <div class="vrow">
            <button class="vbtn" data-action="dec" data-collection="${g.sub.id}" data-id="${c.id}" data-variant="${v.key}" ${editable ? "" : "disabled"}>−</button>
            <span class="vcount">${c.variantes[v.key] || 0}</span>
            <button class="vbtn" data-action="inc" data-collection="${g.sub.id}" data-id="${c.id}" data-variant="${v.key}" ${editable ? "" : "disabled"}>+</button>
          </div>
          <span class="lbl">${v.name}</span>
        </div>`).join("");
      return `
      <div class="card-row ${total === 0 ? "zero" : ""}" style="--type-color:${color}">
        <div class="num-badge">${escapeHtml(c.numero)}</div>
        <div class="card-info">
          <div class="card-name">${escapeHtml(c.nombre)}</div>
          <div class="card-type">${escapeHtml(c.tipo)}</div>
        </div>
        ${variantsHtml}
        <div class="total-badge">${total}<span class="lbl">Total</span></div>
      </div>`;
    }).join("") : `
      <div class="empty-state">
        <div class="glyph">🔍</div>
        <p>No hay cartas que coincidan con la búsqueda.</p>
      </div>`;

    return `
    <div class="inventory-group">
      <div class="inventory-group-title">
        <span class="sidebar-dot" style="--item-color:${meta.accent}"></span>
        ${escapeHtml(g.sub.name)}
      </div>
      <div class="list">${rows}</div>
    </div>`;
  }).join("");

  root.innerHTML = `
  <div class="shell">
    ${sidebarHtml}
    <div class="main">
    <div class="wrap">

      ${userInfoHtml}

      <div class="header">
        <div class="title-block">
          <div class="eyebrow">${escapeHtml(meta.eyebrow)}</div>
          <h1><span style="color:${meta.accent}">${escapeHtml(meta.name)}</span></h1>
        </div>
        <div class="stats">
          <div class="stat-pill"><span class="num">${totalCopies}</span><span class="lbl">Copias</span></div>
          <div class="stat-pill"><span class="num">${totalCards}</span><span class="lbl">Cartas</span></div>
        </div>
      </div>


      <div class="toolbar">
        <div class="search-box">
          <input type="text" id="searchInput" placeholder="Buscar por nombre o número…" value="${escapeHtml(state.search)}">
        </div>
      </div>

      <div class="chips">${statusChipsHtml}</div>
      <div class="chips">${typeChipsHtml}</div>

      ${groupsHtml}

    </div>
    </div>
  </div>`;

  attachEvents();
}

function attachEvents(){
  document.querySelectorAll(".sidebar-item").forEach(item => {
    item.addEventListener("click", () => {
      selectCollection(item.dataset.collection);
    });
  });

  const syncBtn = document.getElementById("syncBtn");
  if(syncBtn){
    syncBtn.addEventListener("click", () => {
      handleSyncClick(syncBtn, () => syncCollection(syncBtn.dataset.collection));
    });
  }

  const syncAllBtn = document.getElementById("syncAllBtn");
  if(syncAllBtn){
    syncAllBtn.addEventListener("click", () => {
      handleSyncClick(syncAllBtn, () => syncAllCollections());
    });
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if(logoutBtn){
    logoutBtn.addEventListener("click", async () => {
      await auth.logout();
      location.reload();
    });
  }

  const fullArtToggle = document.getElementById("fullArtToggle");
  if(fullArtToggle){
    fullArtToggle.addEventListener("click", () => {
      state.onlyFullArt = !state.onlyFullArt;
      render();
    });
  }

  const searchInput = document.getElementById("searchInput");
  if(searchInput){
    searchInput.addEventListener("input", (e) => {
      state.search = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const el = document.getElementById("searchInput");
      if(el){ el.focus(); el.setSelectionRange(pos, pos); }
    });
  }

  document.querySelectorAll(".chip[data-status]").forEach(chip => {
    chip.addEventListener("click", () => {
      state.activeStatus = chip.dataset.status;
      render();
    });
  });

  document.querySelectorAll(".chip[data-type]").forEach(chip => {
    chip.addEventListener("click", () => {
      state.activeType = chip.dataset.type;
      render();
    });
  });

  document.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const collectionId = btn.dataset.collection;
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const variant = btn.dataset.variant;
      if(action === "inc") changeVariant(collectionId, id, variant, 1);
      if(action === "dec") changeVariant(collectionId, id, variant, -1);
    });
  });
}

async function startApp() {
  if(state.activeId === INVENTORY_ID){
    if(!allCollectionsLoaded()){
      render();
      await loadAllCollections();
    } else {
      render();
    }
    return;
  }
  await loadCollection(state.activeId);
}

window.auth = auth;
