// Índice de reimpresiones: traduce un código real de carta ("ASC 007",
// "SCR 009"...) a un id de "grupo" que agrupa todas las reimpresiones
// conocidas de esa misma carta, más un pequeño catálogo de nombre/tipo para
// los grupos que no tienen (o no nos hace falta) su lista de reimpresiones.

let cachedGroups = null;

async function loadReprintGroups(){
  if(cachedGroups) return cachedGroups;
  // Ojo: a diferencia de los `import`, fetch() con ruta relativa se resuelve
  // contra la URL de la página (index.html), no contra la de este módulo.
  // Anclamos explícitamente a import.meta.url para que apunte siempre a la
  // misma carpeta "data/" que usan los imports de colecciones (./data/*.js),
  // sin importar en qué subcarpeta viva index.html.
  const url = new URL("./data/reprint-groups.json", import.meta.url);
  const res = await fetch(url);
  if(!res.ok) throw new Error(`No se pudo cargar reprint-groups.json (${res.status} en ${url})`);
  cachedGroups = await res.json();
  return cachedGroups;
}

function parseCode(codeStr){
  // "ASC 007" -> {set:"ASC", num:7}
  const m = codeStr.trim().match(/^([A-Za-z0-9]+)\s+(\d+)$/);
  if(!m) return null;
  return { set: m[1].toUpperCase(), num: parseInt(m[2], 10) };
}

export function codeKey(set, num){
  return `${String(set).toUpperCase()}-${num}`;
}

let cachedIndex = null;

// codeToGroup: "SET-NUM" (código real, tal cual aparece en una lista
//   exportada) -> reprintGroup
// groupMeta: reprintGroup -> {nombre, tipo} (informativo, para poder decir
//   "reconocida como X" aunque no tengas ninguna copia)
export async function buildReprintIndex(){
  if(cachedIndex) return cachedIndex;

  const groups = await loadReprintGroups();
  const codeToGroup = new Map();
  const groupMeta = new Map();

  for(const entry of groups){
    if(entry.reprints){
      for(const codeStr of entry.reprints){
        const parsed = parseCode(codeStr);
        if(parsed) codeToGroup.set(codeKey(parsed.set, parsed.num), entry.reprintGroup);
      }
      groupMeta.set(entry.reprintGroup, { nombre: entry.id, tipo: null });
    } else {
      groupMeta.set(entry.reprintGroup, { nombre: entry.nombre, tipo: entry.tipo });
    }
  }

  cachedIndex = { codeToGroup, groupMeta };
  return cachedIndex;
}
