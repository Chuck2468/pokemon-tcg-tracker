import { storage } from "./cardRepository.js";
import { state } from "./state.js";
import { isComposite, leafCollections, findLeafMeta, toVariantCard, cardTotal } from "./cardUtils.js";
import { COLLECTIONS } from "./data/collections.js";

// Estas funciones leen/escriben state.cache y hablan con Supabase, pero no
// disparan render() por su cuenta: quien las llama decide cuándo redibujar
// (así evitamos que este módulo dependa de app.js y se cree un ciclo de
// imports).

export async function loadCollectionData(id) {
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

// Precarga en Supabase, a valor 0, las cartas de una colección (o
// subcolección) que aún no tengan fila propia. No toca las que ya existen,
// así que es seguro pulsar el botón varias veces sin perder stock ya
// guardado. Devuelve cuántas filas nuevas se han creado.
export async function initializeCollection(id){
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
export async function syncCollection(id){
  const meta = COLLECTIONS.find(c => c.id === id);
  const leafIds = meta && isComposite(meta) ? meta.subcollections.map(s => s.id) : [id];

  const results = await Promise.all(leafIds.map(lid => initializeCollection(lid)));
  leafIds.forEach(lid => { state.cache[lid] = undefined; });
  await Promise.all(leafIds.map(lid => loadCollectionData(lid)));

  return results.reduce((s, r) => s + r.created, 0);
}

// Sincroniza absolutamente todas las colecciones (todas las hojas: normales
// + subcolecciones de las compuestas).
export async function syncAllCollections(){
  const leafIds = leafCollections().map(c => c.id);

  const results = await Promise.all(leafIds.map(lid => initializeCollection(lid)));
  leafIds.forEach(lid => { state.cache[lid] = undefined; });
  await Promise.all(leafIds.map(lid => loadCollectionData(lid)));

  return results.reduce((s, r) => s + r.created, 0);
}

export function allCollectionsLoaded(){
  return leafCollections().every(c => state.cache[c.id] !== undefined);
}

// Carga las colecciones que falten. No renderiza: el llamador debe hacerlo
// tras el await (ver startApp/selectCollection en app.js).
export async function loadAllCollections(){
  const missing = leafCollections().filter(c => state.cache[c.id] === undefined);
  await Promise.all(missing.map(c => loadCollectionData(c.id)));
}

export function computeStats(maxId){
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

export function filteredCards(){
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
