import { auth } from "./auth.js";
import { storage } from "./cardRepository.js";
import { TYPE_COLORS,TYPE_SOFT,TYPES,VARIANTS } from "./constants.js";
import { COLLECTIONS } from "./data/collections.js";
import { userRepository } from "./userRepository.js";
import { state, INVENTORY_ID, DECKCHECK_ID } from "./state.js";
import {
  escapeHtml,
  getMeta,
  isComposite,
  leafCollections,
  splitCollectionName,
  buildProgressHtml,
  cardTotal,
  applicableVariants
} from "./cardUtils.js";
import { openCardImage } from "./imageModal.js";
import {
  loadCollectionData,
  syncCollection,
  syncAllCollections,
  allCollectionsLoaded,
  loadAllCollections,
  computeStats,
  filteredCards
} from "./collectionsService.js";
import { checkDeckAgainstInventory } from "./deckChecker.js";

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

async function loadCollection(id) {
  await loadCollectionData(id);
  render();
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

function selectCollection(id){
  if(id === state.activeId) return;
  // Los viewers no pueden navegar a colecciones individuales, solo al
  // Inventario y al Comprobador de Mazos (ambos son de solo lectura).
  if(id !== INVENTORY_ID && id !== DECKCHECK_ID && state.user?.role !== "admin") return;

  state.activeId = id;
  state.search = "";
  state.activeType = "ALL";
  state.activeStatus = "ALL";
  state.onlyFullArt = false;

  // El Comprobador de Mazos necesita el stock de todas las colecciones para
  // poder sumar reimpresiones, igual que el Inventario.
  if(id === INVENTORY_ID || id === DECKCHECK_ID){
    if(!allCollectionsLoaded()){
      render();
      loadAllCollections().then(render);
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

// Navegación desde la barra móvil inferior: a diferencia de selectCollection
// (que no hace nada si ya estás en esa colección), aquí SIEMPRE hay que
// cerrar el panel desplegado y volver a pintar, aunque el destino sea la
// vista en la que ya estás (p.ej. tocar "Inventario" solo para cerrar el
// panel de Colecciones que tenías abierto).
function mobileNavigate(id){
  state.mobileMenuOpen = null;
  if(id === state.activeId){
    render();
  } else {
    selectCollection(id);
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

// Iconos de bola para el sidebar: Honorball (blanca con banda roja) para
// Inventario/Comprobador de Mazos, ya que son las únicas entradas visibles
// también para usuarios no admin; Poké Ball (roja) para las colecciones.
function honorballIconSvg(){
  return `
    <svg width="15" height="15" viewBox="0 0 32 32" aria-hidden="true" class="sidebar-ball">
      <circle cx="16" cy="16" r="14.5" fill="#f1ede4" stroke="#f1ede4" stroke-width="1.5"/>
      <rect x="1.5" y="14.5" width="29" height="3" fill="#ef4444"/>
      <circle cx="16" cy="16" r="5" fill="#ef4444"/>
      <circle cx="16" cy="16" r="2.4" fill="#f1ede4"/>
    </svg>`;
}

function pokeballIconSvg(){
  return `
    <svg width="15" height="15" viewBox="0 0 32 32" aria-hidden="true" class="sidebar-ball">
      <circle cx="16" cy="16" r="14.5" fill="#ef4444" stroke="#12141c" stroke-width="1.5"/>
      <path d="M1.5 16 A14.5 14.5 0 0 1 30.5 16 Z" fill="#ef4444"/>
      <path d="M1.5 16 A14.5 14.5 0 0 0 30.5 16 Z" fill="#f1ede4"/>
      <rect x="1.5" y="14.5" width="29" height="3" fill="#12141c"/>
      <circle cx="16" cy="16" r="5" fill="#12141c"/>
      <circle cx="16" cy="16" r="3" fill="#f1ede4"/>
    </svg>`;
}

function buildSidebarHtml(){
  const isAdmin = state.user?.role === "admin";

  const inventoryItem = `
    <div class="sidebar-item sidebar-item-inventory ${state.activeId === INVENTORY_ID ? "active" : ""}" data-collection="${INVENTORY_ID}">
      ${honorballIconSvg()}
      <span class="sidebar-name">
        <span class="sidebar-name-title">Inventario</span>
      </span>
    </div>`;

  const deckCheckItem = `
    <div class="sidebar-item sidebar-item-inventory ${state.activeId === DECKCHECK_ID ? "active" : ""}" data-collection="${DECKCHECK_ID}">
      ${honorballIconSvg()}
      <span class="sidebar-name">
        <span class="sidebar-name-title">Comprobador de Mazos</span>
      </span>
    </div>`;

  // Los viewers solo ven el Inventario y el Comprobador de Mazos: sin
  // listado de colecciones ni botones de edición.
  if(!isAdmin){
    return `
    <div class="sidebar">
      <div class="sidebar-title">Herramientas</div>
      ${inventoryItem}
      ${deckCheckItem}
    </div>`;
  }

  const items = COLLECTIONS.map(c => {
    const {title, abbr} = splitCollectionName(c.name);
    return `
    <div class="sidebar-item ${c.id === state.activeId ? "active" : ""}" data-collection="${c.id}">
      ${pokeballIconSvg()}
      <span class="sidebar-name">
        <span class="sidebar-name-title">${escapeHtml(title)}</span>
        ${abbr ? `<span class="sidebar-name-abbr">${escapeHtml(abbr)}</span>` : ""}
      </span>
    </div>`;
  }).join("");
  return `
    <div class="sidebar">
      <div class="sidebar-title">Herramientas</div>
      ${inventoryItem}
      ${deckCheckItem}
      <div class="sidebar-title">Colecciones</div>
      ${items}
      <div class="sidebar-hint">Cuando tengas la lista de otra colección, pásamela y la añado aquí.</div>
    </div>`;
}

// Construye el contenido del panel "Filtro" de la barra móvil. Solo enseña
// los chips (Tipo/Estado/FullArt): el buscador se queda únicamente en el
// toolbar de arriba de cada vista, así no se duplica el mismo control en
// dos sitios distintos de la pantalla. Los filtros disponibles cambian
// según la vista activa: en el Inventario son Tipo + Solo FullArt (no hay
// estado "Pendientes" porque el Inventario ya solo enseña cartas que
// tienes); en una colección concreta (o Black Star Promos) son Estado +
// Tipo, igual que en el toolbar de escritorio. Los chips usan los mismos
// atributos data-status/data-type que los del toolbar normal, así que un
// único listener delegado (ver attachEvents) sirve para ambos sitios sin
// duplicar lógica.
function buildMobileFilterSheetHtml(){
  const isInventory = state.activeId === INVENTORY_ID;

  const typeChipsHtml = ["ALL", ...TYPES].map(t => {
    const label = t === "ALL" ? "Todos los tipos" : t;
    const active = state.activeType === t;
    const color = t === "ALL" ? "var(--ink)" : TYPE_COLORS[t];
    return `<div class="chip ${active ? "active" : ""}" data-type="${t}"
      style="${active ? `background:${color};` : ""}">${escapeHtml(label)}</div>`;
  }).join("");

  const typeGroupHtml = `
    <div class="filter-group">
      <div class="filter-group-label">Tipo</div>
      <div class="chips">${typeChipsHtml}</div>
    </div>`;

  const extraGroupHtml = isInventory
    ? `
    <div class="filter-group">
      <div class="filter-group-label">Variante</div>
      <div class="chips">
        <div class="chip ${state.onlyFullArt ? "active" : ""}" id="fullArtToggleMobile"
          style="${state.onlyFullArt ? `background:var(--v-fullart);` : ""}">Solo FullArt</div>
      </div>
    </div>`
    : `
    <div class="filter-group">
      <div class="filter-group-label">Estado</div>
      <div class="chips">
        ${["ALL", "PENDING"].map(s => {
          const label = s === "ALL" ? "Todas" : "Pendientes";
          const active = state.activeStatus === s;
          const color = s === "ALL" ? "var(--ink)" : "var(--pending)";
          return `<div class="chip ${active ? "active" : ""}" data-status="${s}"
            style="${active ? `background:${color};` : ""}">${escapeHtml(label)}</div>`;
        }).join("")}
      </div>
    </div>`;

  // En Inventario el orden habitual es Tipo → FullArt; en una colección es
  // Estado → Tipo (igual que en sus respectivos toolbars).
  const groupsHtml = isInventory ? `${typeGroupHtml}${extraGroupHtml}` : `${extraGroupHtml}${typeGroupHtml}`;

  return `
    <div class="mobile-sheet mobile-sheet-filters">
      <div class="mobile-sheet-title">Filtros · ${isInventory ? "Inventario" : "Colección"}</div>
      ${groupsHtml}
    </div>`;
}

// ---- Barra de navegación móvil (Inventario / Colecciones / Herramientas / Filtro) ----
// Sustituye, solo en pantallas estrechas, al sidebar de escritorio (que en
// móvil quedaba como una tira horizontal con scroll incómoda). "Inventario"
// navega directo; "Colecciones" (solo admin), "Herramientas" y "Filtro"
// despliegan un panel tipo hoja que se desliza justo encima de la barra.
function buildMobileNavHtml(){
  const isAdmin = state.user?.role === "admin";
  const open = state.mobileMenuOpen;

  // El marco de "activo" no debe depender solo de si el panel desplegable
  // está abierto: también hay que mostrarlo cuando ya estás navegando
  // dentro de esa sección (una colección concreta, o el Comprobador de
  // Mazos) aunque el panel esté cerrado. Sin esto, el marco desaparecía en
  // cuanto se elegía un elemento y se cerraba la hoja desplegable.
  const isCollectionView = state.activeId !== INVENTORY_ID && state.activeId !== DECKCHECK_ID;
  const isToolsView = state.activeId === DECKCHECK_ID;
  // El Comprobador de Mazos no tiene búsqueda ni chips que filtrar, así que
  // el botón "Filtro" no tiene sentido en esa vista: se oculta en vez de
  // abrir un panel vacío.
  const hasFilters = state.activeId !== DECKCHECK_ID;

  let panelHtml = "";
  if(open === "colecciones" && isAdmin){
    const items = COLLECTIONS.map(c => {
      const {title, abbr} = splitCollectionName(c.name);
      return `
      <div class="mobile-sheet-item ${c.id === state.activeId ? "active" : ""}" data-collection="${c.id}">
        ${pokeballIconSvg()}
        <span class="sidebar-name">
          <span class="sidebar-name-title">${escapeHtml(title)}</span>
          ${abbr ? `<span class="sidebar-name-abbr">${escapeHtml(abbr)}</span>` : ""}
        </span>
      </div>`;
    }).join("");
    panelHtml = `
      <div class="mobile-sheet">
        <div class="mobile-sheet-title">Colecciones</div>
        ${items}
      </div>`;
  } else if(open === "herramientas"){
    panelHtml = `
      <div class="mobile-sheet">
        <div class="mobile-sheet-title">Herramientas</div>
        <div class="mobile-sheet-item ${state.activeId === DECKCHECK_ID ? "active" : ""}" data-collection="${DECKCHECK_ID}">
          ${honorballIconSvg()}
          <span class="sidebar-name">
            <span class="sidebar-name-title">Comprobador de Mazos</span>
          </span>
        </div>
        <div class="mobile-sheet-item disabled">
          <i class="ti ti-plus" aria-hidden="true"></i>
          <span class="sidebar-name">
            <span class="sidebar-name-title">Próximas herramientas aquí</span>
          </span>
        </div>
      </div>`;
  } else if(open === "filtro" && hasFilters){
    panelHtml = buildMobileFilterSheetHtml();
  }

  const backdropHtml = open ? `<div class="mobile-sheet-backdrop" data-mobile-close="1"></div>` : "";

  return `
    ${backdropHtml}
    <div class="mobile-bottom-area">
      ${panelHtml}
      <nav class="mobile-nav">
        <button type="button" class="mobile-nav-btn ${(state.activeId === INVENTORY_ID && !open) ? "active" : ""}" data-mobile-nav="${INVENTORY_ID}">
          <i class="ti ti-clipboard-list" aria-hidden="true"></i>
          <span>Inventario</span>
        </button>
        ${isAdmin ? `
        <button type="button" class="mobile-nav-btn ${(open === "colecciones" || (isCollectionView && !open)) ? "active" : ""}" data-mobile-toggle="colecciones">
          <i class="ti ti-stack-2" aria-hidden="true"></i>
          <span>Colecciones</span>
        </button>` : ""}
        <button type="button" class="mobile-nav-btn ${(open === "herramientas" || (isToolsView && !open)) ? "active" : ""}" data-mobile-toggle="herramientas">
          <i class="ti ti-tools" aria-hidden="true"></i>
          <span>Herramientas</span>
        </button>
        ${hasFilters ? `
        <button type="button" class="mobile-nav-btn ${open === "filtro" ? "active" : ""}" data-mobile-toggle="filtro">
          <i class="ti ti-filter" aria-hidden="true"></i>
          <span>Filtro</span>
        </button>` : ""}
      </nav>
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
  const sidebarHtml = buildSidebarHtml() + buildMobileNavHtml();

  if(state.activeId === INVENTORY_ID){
    renderInventory(sidebarHtml);
    return;
  }

  if(state.activeId === DECKCHECK_ID){
    renderDeckChecker(sidebarHtml);
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
        <span class="lbl"><span class="lbl-full">${escapeHtml(v.name)}</span><span class="lbl-short">${escapeHtml(v.short || v.name)}</span></span>
      </div>`).join("");
    return `
    <div class="card-row ${total === 0 ? "zero" : ""}" style="--type-color:${color}" data-series="${escapeHtml(meta.tcgdexSeries)}" data-set="${escapeHtml(meta.tcgdexSet)}" data-cardid="${escapeHtml(c.id)}">
      <div class="card-main">
        <div class="num-badge">${escapeHtml(c.numero)}</div>
        <div class="card-info">
          <div class="card-name">${escapeHtml(c.nombre)}</div>
          <div class="card-type">${escapeHtml(c.tipo)}</div>
        </div>
      </div>
      <div class="variants-row">${variantsHtml}</div>
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
          <span class="lbl"><span class="lbl-full">${escapeHtml(v.name)}</span><span class="lbl-short">${escapeHtml(v.short || v.name)}</span></span>
        </div>`).join("");
      return `
      <div class="card-row" style="--type-color:${color}" data-series="${escapeHtml(g.meta.tcgdexSeries)}" data-set="${escapeHtml(g.meta.tcgdexSet)}" data-cardid="${escapeHtml(c.id)}">
        <div class="card-main">
          <div class="num-badge">${escapeHtml(c.numero)}</div>
          <div class="card-info">
            <div class="card-name">${escapeHtml(c.nombre)}</div>
            <div class="card-type">${escapeHtml(c.tipo)}</div>
          </div>
        </div>
        <div class="variants-row">${variantsHtml}</div>
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

const STATUS_ICON = { exact: "✅", reprint: "🔄", partial: "⚠️", missing: "❌", unknown: "❓" };
const STATUS_LABEL = {
  exact: "Tienes la edición pedida",
  reprint: "Tienes suficientes, en otra edición",
  partial: "Incompleta",
  missing: "Sin stock",
  unknown: "No reconocida"
};

function buildSourcesListHtml(label, sources){
  // sources puede ser el desglose por colección ({name, owned}) o por
  // código de carta ({code, owned}) — buildCodeItemHtml decide cuál usar.
  const itemsHtml = sources.map(buildCodeItemHtml).join("");
  return `
    <div class="deck-row-sources">
      <span class="deck-row-sources-label">${label}</span>
      <ul>${itemsHtml}</ul>
    </div>`;
}

function buildCodeItemHtml(s){
  if(s.code) return `<li>${escapeHtml(s.code)} (${s.owned})</li>`;
  return `<li>${escapeHtml(s.name)} (${s.owned})</li>`;
}

function buildDeckCheckResultHtml(result){
  if(!result) return "";

  const counts = result.results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const summaryHtml = `
    <div class="deck-summary">
      <span class="deck-summary-item exact">✅ ${counts.exact || 0}</span>
      <span class="deck-summary-item reprint">🔄 ${counts.reprint || 0}</span>
      <span class="deck-summary-item partial">⚠️ ${counts.partial || 0}</span>
      <span class="deck-summary-item missing">❌ ${counts.missing || 0}</span>
      <span class="deck-summary-item unknown">❓ ${counts.unknown || 0}</span>
    </div>`;

  // Lo que requiere tu atención primero (falta algo, o hay que ir a buscarla
  // a otra colección), luego lo incompleto/sin stock, y lo ya resuelto al
  // final para no tener que desplazarse entre ello.
  const order = { reprint: 0, partial: 1, missing: 2, unknown: 3, exact: 4 };
  const sorted = [...result.results].sort((a, b) => order[a.status] - order[b.status]);

  // El desglose "dónde las tienes" solo aporta algo cuando la respuesta no
  // es obvia: si es la edición exacta pedida (ya sabes dónde está: en la
  // colección que has consultado) o si no tienes ninguna copia, mostrarlo
  // es ruido. Solo se pinta para 🔄 y ⚠️.
  const rowsHtml = sorted.length ? sorted.map(r => {
    let noteHtml = "";
    let sourcesHtml = "";
    if(r.status === "unknown"){
      noteHtml = `<span class="deck-row-note">No está en tus colecciones ni en la base de reimpresiones.</span>`;
    } else if(r.status === "reprint"){
      // Reemplazable: lo que importa es a qué código ir a buscarlas, no en
      // qué colección interna viven ni cuántas hay en cada una.
      sourcesHtml = buildSourcesListHtml("Cógelas de:", r.codeSources);
    } else if(r.status === "partial"){
      noteHtml = `<span class="deck-row-note">Faltan ${r.missing}.</span>`;
      if(r.sources.length){
        sourcesHtml = buildSourcesListHtml("Tienes en:", r.sources);
      }
    }
    return `
    <div class="deck-row deck-row-${r.status}">
      <span class="deck-row-status" title="${STATUS_LABEL[r.status]}">${STATUS_ICON[r.status]}</span>
      <span class="deck-row-name">${escapeHtml(r.displayName)} <span class="deck-row-code">[${escapeHtml(r.requestedCode)}]</span></span>
      <span class="deck-row-count">${r.displayOwned} / ${r.needed}</span>
      ${noteHtml}
      ${sourcesHtml}
    </div>`;
  }).join("") : `
    <div class="empty-state">
      <div class="glyph">🃏</div>
      <p>No se ha reconocido ninguna carta en el texto pegado.</p>
    </div>`;

  const energyNoteHtml = result.skippedEnergy > 0
    ? `<p class="deck-note">${result.skippedEnergy === 1 ? "Se ha omitido 1 línea" : `Se han omitido ${result.skippedEnergy} líneas`} de energía básica (se asume que siempre tienes suficientes).</p>`
    : "";

  const warningsHtml = result.warnings.length ? `
    <div class="deck-warnings">
      <p>No he podido interpretar estas líneas, revísalas a mano:</p>
      <ul>${result.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join("")}</ul>
    </div>` : "";

  return `
    <div class="deck-results">
      ${summaryHtml}
      <div class="deck-rows">${rowsHtml}</div>
      ${energyNoteHtml}
      ${warningsHtml}
    </div>`;
}

function renderDeckChecker(sidebarHtml){
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
  const resultHtml = buildDeckCheckResultHtml(state.deckCheckResult);

  root.innerHTML = `
  <div class="shell">
    ${sidebarHtml}
    <div class="main">
    <div class="wrap">

      ${userInfoHtml}

      <div class="header">
        <div class="title-block">
          <div class="eyebrow">Antes de imprimir la lista</div>
          <h1>Comprobador de <span style="color:var(--estadio)">Mazos</span></h1>
        </div>
      </div>

      <p class="deck-intro">Pega aquí la lista exportada desde Pokémon TCG Live o Limitless (formato «cantidad nombre SET número») y te digo si tienes stock suficiente, contando también reimpresiones equivalentes de otras colecciones.</p>

      <textarea id="deckListInput" class="deck-textarea" rows="12" placeholder="4 Ultra Ball SVI 196&#10;2 Charizard ex OBF 125&#10;8 Basic {R} Energy SVE 2&#10;...">${escapeHtml(state.deckListText)}</textarea>

      <div class="toolbar">
        <button id="checkDeckBtn" class="sync-btn deck-check-btn">Comprobar mazo</button>
      </div>

      ${resultHtml}

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
          <span class="lbl"><span class="lbl-full">${escapeHtml(v.name)}</span><span class="lbl-short">${escapeHtml(v.short || v.name)}</span></span>
        </div>`).join("");
      return `
      <div class="card-row ${total === 0 ? "zero" : ""}" style="--type-color:${color}" data-series="${escapeHtml(g.sub.tcgdexSeries)}" data-set="${escapeHtml(g.sub.tcgdexSet)}" data-cardid="${escapeHtml(c.id)}">
        <div class="card-main">
          <div class="num-badge">${escapeHtml(c.numero)}</div>
          <div class="card-info">
            <div class="card-name">${escapeHtml(c.nombre)}</div>
            <div class="card-type">${escapeHtml(c.tipo)}</div>
          </div>
        </div>
        <div class="variants-row">${variantsHtml}</div>
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

  // Barra móvil inferior: "Inventario" navega directo; "Colecciones" y
  // "Herramientas" abren/cierran su panel (si tocas el que ya está abierto,
  // se cierra); los items dentro del panel navegan y lo cierran.
  document.querySelectorAll("[data-mobile-nav]").forEach(btn => {
    btn.addEventListener("click", () => {
      mobileNavigate(btn.dataset.mobileNav);
    });
  });
  document.querySelectorAll("[data-mobile-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.mobileToggle;
      state.mobileMenuOpen = state.mobileMenuOpen === key ? null : key;
      render();
    });
  });
  document.querySelectorAll(".mobile-sheet-item[data-collection]").forEach(item => {
    item.addEventListener("click", () => {
      mobileNavigate(item.dataset.collection);
    });
  });
  document.querySelectorAll("[data-mobile-close]").forEach(el => {
    el.addEventListener("click", () => {
      state.mobileMenuOpen = null;
      render();
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

  // Versión del toggle FullArt que vive dentro del panel "Filtro" de la
  // barra móvil (id distinto porque el toolbar de escritorio ya usa
  // "fullArtToggle" y no puede haber dos elementos con el mismo id).
  const fullArtToggleMobile = document.getElementById("fullArtToggleMobile");
  if(fullArtToggleMobile){
    fullArtToggleMobile.addEventListener("click", () => {
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

  document.querySelectorAll(".card-row[data-cardid]").forEach(row => {
    row.addEventListener("click", (e) => {
      // No abrir la imagen si el click viene de un botón +/- de variante.
      if(e.target.closest(".vbtn")) return;
      const { series, set, cardid } = row.dataset;
      if(series && set && cardid) openCardImage(series, set, cardid);
    });
  });

  const checkDeckBtn = document.getElementById("checkDeckBtn");
  if(checkDeckBtn){
    checkDeckBtn.addEventListener("click", async () => {
      const textarea = document.getElementById("deckListInput");
      state.deckListText = textarea ? textarea.value : state.deckListText;

      checkDeckBtn.disabled = true;
      checkDeckBtn.textContent = "Comprobando…";
      try {
        if(!allCollectionsLoaded()){
          await loadAllCollections();
        }
        state.deckCheckResult = await checkDeckAgainstInventory(state.deckListText, state.cache);
      } catch (error) {
        console.error(error);
        alert("Hubo un error al comprobar el mazo. Revisa la consola.");
      } finally {
        checkDeckBtn.disabled = false;
        checkDeckBtn.textContent = "Comprobar mazo";
      }
      render();
    });
  }

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
      render();
    } else {
      render();
    }
    return;
  }
  await loadCollection(state.activeId);
}

window.auth = auth;
