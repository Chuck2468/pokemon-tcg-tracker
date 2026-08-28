import { leafCollections, cardTotal } from "./cardUtils.js";
import { parseDecklist } from "./deckListParser.js";
import { buildReprintIndex, codeKey } from "./reprintIndex.js";

function normalizeName(str){
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

// A partir de lo que ya está cargado en state.cache, construye:
// - localByCode: código exacto ("SET-NUM") -> {collectionId, card}
// - localByGroup: reprintGroup -> [{collectionId, card}] (solo cartas con
//   reprintGroup != 0)
// - localByName: nombre normalizado -> [{collectionId, card}], para TODAS
//   las cartas. Se usa como respaldo en cartas que no son Pokémon (ver
//   resolveEntry), porque una carta de Entrenador/Estadio/Herramienta/
//   Energía especial con el mismo nombre exacto es SIEMPRE la misma carta
//   por reglas del juego, y el reprintGroup entre colecciones distintas no
//   siempre está bien enlazado para estos tipos.
function buildLocalIndex(cache){
  const localByCode = new Map();
  const localByGroup = new Map();
  const localByName = new Map();

  for(const meta of leafCollections()){
    const cards = cache[meta.id];
    if(!cards) continue;
    for(const card of cards){
      const key = codeKey(card.set, parseInt(card.id, 10));
      const entry = { collectionId: meta.id, card };

      localByCode.set(key, entry);

      if(card.reprintGroup){
        if(!localByGroup.has(card.reprintGroup)) localByGroup.set(card.reprintGroup, []);
        localByGroup.get(card.reprintGroup).push(entry);
      }

      const nameKey = normalizeName(card.nombre);
      if(!localByName.has(nameKey)) localByName.set(nameKey, []);
      localByName.get(nameKey).push(entry);
    }
  }

  return { localByCode, localByGroup, localByName };
}

function mergeOwners(...lists){
  const merged = new Map();
  for(const list of lists){
    for(const o of list){
      merged.set(`${o.collectionId}-${o.card.id}`, o);
    }
  }
  return [...merged.values()];
}

function buildSources(owners, collectionNames){
  const byCollection = new Map();
  for(const o of owners){
    const owned = cardTotal(o.card);
    if(owned <= 0) continue;
    byCollection.set(o.collectionId, (byCollection.get(o.collectionId) || 0) + owned);
  }
  return [...byCollection.entries()]
    .map(([collectionId, owned]) => ({
      collectionId,
      name: collectionNames.get(collectionId) || collectionId,
      owned
    }))
    .sort((a, b) => b.owned - a.owned);
}

// Resuelve una línea de la lista contra el inventario local. Devuelve
// cuántas copias tienes en total (sumando reimpresiones/nombre según el
// tipo de carta), cuántas de esas son de la edición EXACTA pedida en la
// línea (para poder distinguir "la tienes tal cual" de "la tienes pero en
// otra edición"), y si se ha podido reconocer (aunque tengas 0 copias).
function resolveEntry(entry, indexes, codeToGroup, groupMeta){
  const { localByCode, localByGroup, localByName } = indexes;
  const key = codeKey(entry.setCode, entry.number);
  const direct = localByCode.get(key);

  let owners = [];
  let reprintGroup = null;
  let recognizedName = null;
  let tipo = null;

  if(direct){
    tipo = direct.card.tipo;
    recognizedName = direct.card.nombre;
    reprintGroup = direct.card.reprintGroup || null;
    owners = reprintGroup ? (localByGroup.get(reprintGroup) || [direct]) : [direct];
  } else {
    const group = codeToGroup.get(key);
    if(group){
      reprintGroup = group;
      owners = localByGroup.get(group) || [];
      const meta = groupMeta.get(group);
      if(meta){
        recognizedName = meta.nombre;
        tipo = meta.tipo;
      }
    }
  }

  // Cartas que no son Pokémon: el nombre completo ya identifica la carta de
  // forma única (dos cartas de Entrenador no pueden compartir nombre y ser
  // distintas), así que sumamos TODAS las copias con ese nombre exacto en
  // cualquier colección, en vez de depender solo del reprintGroup.
  if(tipo && tipo !== "Pokémon" && recognizedName){
    const byName = localByName.get(normalizeName(recognizedName)) || [];
    owners = mergeOwners(owners, byName);
  }

  // "Exacta" = lo que tienes bajo el mismo código (SET+número) que se pidió
  // en la línea. Para no-Pokémon eso es simplemente `direct`, ya que el
  // resto de `owners` viene de la búsqueda por nombre (otras ediciones).
  const exactOwned = direct ? cardTotal(direct.card) : 0;
  const totalOwned = owners.reduce((s, o) => s + cardTotal(o.card), 0);

  return {
    owners,
    exactOwned,
    totalOwned,
    reprintGroup,
    recognizedName,
    tipo,
    recognized: !!direct || !!reprintGroup
  };
}

// Identidad usada para agrupar varias líneas de la lista que en realidad
// piden la misma carta: por nombre para no-Pokémon (más fiable que el
// reprintGroup para estos tipos, ver arriba), por reprintGroup/código para
// el resto.
function identityKey(entry, resolved){
  if(resolved.tipo && resolved.tipo !== "Pokémon" && resolved.recognizedName){
    return `n:${normalizeName(resolved.recognizedName)}`;
  }
  if(resolved.reprintGroup) return `g:${resolved.reprintGroup}`;
  return `c:${codeKey(entry.setCode, entry.number)}`;
}

// Punto de entrada: recibe el texto pegado por el usuario y el state.cache
// (con TODAS las colecciones ya cargadas), y devuelve el resultado listo
// para pintar.
export async function checkDeckAgainstInventory(rawText, cache){
  const { entries, warnings } = parseDecklist(rawText);
  const indexes = buildLocalIndex(cache);
  const { codeToGroup, groupMeta } = await buildReprintIndex();
  const collectionNames = new Map(leafCollections().map(m => [m.id, m.name]));

  const grouped = new Map();
  let skippedEnergy = 0;

  for(const entry of entries){
    if(entry.isBasicEnergy){
      skippedEnergy++;
      continue;
    }

    const resolved = resolveEntry(entry, indexes, codeToGroup, groupMeta);
    const key = identityKey(entry, resolved);

    if(!grouped.has(key)){
      grouped.set(key, {
        displayName: resolved.recognizedName || entry.name,
        needed: 0,
        exactOwned: 0,
        totalOwned: resolved.totalOwned,
        recognized: resolved.recognized,
        recognizedName: resolved.recognizedName,
        sources: buildSources(resolved.owners, collectionNames),
        lines: []
      });
    }
    const g = grouped.get(key);
    g.needed += entry.quantity;
    // Varias líneas de la lista pueden mapear a la misma carta (p.ej. dos
    // ediciones distintas del mismo Pokémon). La cantidad "exacta" es la
    // suma de lo que tienes bajo cada uno de esos códigos concretos, no de
    // todo el reprintGroup.
    g.exactOwned += resolved.exactOwned;
    g.lines.push(entry.raw);
  }

  // Cuatro estados, en vez de fusionar "la tienes tal cual" y "la tienes
  // pero en otra edición" en un único "ok": así sabemos cuándo merece la
  // pena mostrar el desglose de dónde está el stock.
  const results = [...grouped.values()].map(g => {
    const missing = Math.max(0, g.needed - g.totalOwned);
    let status;
    if(!g.recognized) status = "unknown";
    else if(g.exactOwned >= g.needed) status = "exact";
    else if(g.totalOwned >= g.needed) status = "reprint";
    else if(g.totalOwned > 0) status = "partial";
    else status = "missing";
    return { ...g, missing, status };
  });

  return { results, warnings, skippedEnergy };
}
