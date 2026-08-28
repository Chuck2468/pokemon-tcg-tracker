import { VARIANTS } from "./constants.js";
import { COLLECTIONS } from "./data/collections.js";

// Funciones puras sobre cartas y metadatos de colección: no dependen del
// estado global ni tocan el DOM, así que se pueden testear/reutilizar sueltas.

export function escapeHtml(str){
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

export function getMeta(id){
  return COLLECTIONS.find(c => c.id === id) || COLLECTIONS[0];
}

// Una colección "compuesta" (p.ej. Black Star Promos) no tiene seed propio:
// agrupa varias subcolecciones (MEP, SVP...) que sí lo tienen.
export function isComposite(meta){
  return !!(meta && meta.subcollections);
}

// Lista plana de todas las unidades cargables/almacenables: las colecciones
// normales tal cual, y las subcolecciones de las compuestas. Se usa para
// cargar datos, comprobar si todo está cargado, y para agrupar el Inventario.
export function leafCollections(){
  return COLLECTIONS.flatMap(c => isComposite(c) ? c.subcollections : [c]);
}

export function findLeafMeta(id){
  return leafCollections().find(c => c.id === id) || null;
}

export function toVariantCard(raw){
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

export function cardTotal(card){
  return VARIANTS.reduce((s,v) => s + (card.variantes[v.key] || 0), 0);
}

// Las cartas del Set de Juego (id <= gameSetMax) solo pueden ser Normal/Reverse/Holo.
// Las cartas exclusivas del Set Maestro (más allá del Set de Juego) son siempre FullArt.
// Si por algún motivo hay stock cargado en una variante "no esperada", se sigue mostrando
// para no ocultar datos reales.
export function applicableVariants(card, gameSetMax){
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

export function splitCollectionName(name){
  const m = name.match(/^(.*)\s\[([^\]]+)\]$/);
  if(m) return {title: m[1], abbr: `[${m[2]}]`};
  return {title: name, abbr: ""};
}

export function buildProgressHtml(pct){
  return `<div class="progress-seg" style="width:${pct}%; background:var(--electric-blue);"></div>`;
}
