import { storage } from "./cardRepository.js";
import { TYPE_COLORS,TYPE_SOFT,TYPES,VARIANTS } from "./constants.js";
import { COLLECTIONS } from "./data/collections.js";

let state = {
  activeId: COLLECTIONS[0].id,
  cache: {},           // collectionId -> array of cards, or undefined if not loaded yet
  search: "",
  activeType: "ALL",
  activeStatus: "ALL",
  saveError: false
};

const root = document.getElementById("root");

function escapeHtml(str){
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function getMeta(id){
  return COLLECTIONS.find(c => c.id === id) || COLLECTIONS[0];
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

async function loadCollection(id) {
  const meta = getMeta(id);
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
    render();
}

function selectCollection(id){
  if(id === state.activeId) return;
  state.activeId = id;
  state.search = "";
  state.activeType = "ALL";
  state.activeStatus = "ALL";
  if(state.cache[id] === undefined){
    render();
    loadCollection(id);
  } else {
    render();
  }
}

async function changeVariant(id, variantKey, delta){
  const cards = state.cache[state.activeId];
  const card = cards.find(c => c.id === id);
  if(!card) return;
  card.variantes[variantKey] = Math.max(0, (card.variantes[variantKey] || 0) + delta);
  await storage.saveCard(state.activeId, card);
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
      <div class="sidebar-title">Colecciones</div>
      ${items}
      <div class="sidebar-hint">Cuando tengas la lista de otra colección, pásamela y la añado aquí.</div>
    </div>`;
}

function render(){
  const meta = getMeta(state.activeId);
  const sidebarHtml = buildSidebarHtml();

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

  const progressJuegoHtml = buildProgressHtml(juego.pct);
  const progressMaestroHtml = buildProgressHtml(maestro.pct);

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
    const variantsHtml = VARIANTS.map(v => `
      <div class="variant-badge" style="--variant-color:${v.color}">
        <div class="vrow">
          <button class="vbtn" data-action="dec" data-id="${c.id}" data-variant="${v.key}">−</button>
          <span class="vcount">${c.variantes[v.key] || 0}</span>
          <button class="vbtn" data-action="inc" data-id="${c.id}" data-variant="${v.key}">+</button>
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

      <div class="header">
        <div class="title-block">
          <div class="eyebrow">${escapeHtml(meta.eyebrow)}</div>
          <h1>Colección <span style="color:${meta.accent}">${escapeHtml(meta.name)}</span></h1>
        </div>
        <div class="stats">
          <div class="stat-pill"><span class="num">${maestro.copies}</span><span class="lbl">Copias</span></div>
          <div class="stat-pill"><span class="num">${juego.pct}%</span><span class="lbl">Set Juego</span></div>
          <div class="stat-pill"><span class="num">${maestro.pct}%</span><span class="lbl">Set Maestro</span></div>
        </div>
      </div>

      <div class="progress-strip">
        <div class="row"><span>Set de Juego (001–${String(meta.gameSetMax).padStart(3,"0")})</span><span>${juego.owned} de ${juego.total} obtenidas · ${juego.pct}%</span></div>
        <div class="progress-track">${progressJuegoHtml}</div>
      </div>

      <div class="progress-strip">
        <div class="row"><span>Set Maestro (001–${String(maestro.total).padStart(3,"0")})</span><span>${maestro.owned} de ${maestro.total} obtenidas · ${maestro.pct}%</span></div>
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

function attachEvents(){
  document.querySelectorAll(".sidebar-item").forEach(item => {
    item.addEventListener("click", () => {
      selectCollection(item.dataset.collection);
    });
  });

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
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const variant = btn.dataset.variant;
      if(action === "inc") changeVariant(id, variant, 1);
      if(action === "dec") changeVariant(id, variant, -1);
    });
  });
}

loadCollection(state.activeId);