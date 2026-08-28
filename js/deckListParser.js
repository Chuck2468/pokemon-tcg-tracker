// Parser de listas de mazo exportadas desde Pokémon TCG Live o Limitless.
// Ambas usan el mismo formato de línea: "<cantidad> <nombre> <SET> <número>",
// con cabeceras de sección ("Pokémon:", "Trainer:", "Energy:") y un total
// final ("Total Cards: 60") que hay que ignorar.

const HEADER_RE = /^(pok[eé]mon|trainer(\s*card)?|entrenador|energy|energ[ií]a)\s*:?\s*\d*$/i;
const TOTAL_RE = /^total\s+cards?\s*:?\s*\d*$/i;

// Última "palabra" = número de carta (puede llevar letras, p.ej. "TG05" o
// "SWSH009"); penúltima = código de set. Todo lo anterior es el nombre.
const LINE_RE = /^(\d+)\s+(.+?)\s+([A-Za-z0-9]{2,10})\s+([A-Za-z0-9]{1,8})$/;

const BASIC_ENERGY_RE = /^basic\s+\{?[a-z]+\}?\s+energy$/i;

export function parseDecklist(text){
  const entries = [];
  const warnings = [];

  const lines = (text || "")
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  for(const line of lines){
    if(HEADER_RE.test(line) || TOTAL_RE.test(line)) continue;

    const m = line.match(LINE_RE);
    if(!m){
      warnings.push(line);
      continue;
    }

    const [, qtyStr, name, setCode, numStr] = m;
    const quantity = parseInt(qtyStr, 10);
    const number = parseInt(numStr.replace(/\D/g, ""), 10);

    if(!quantity || Number.isNaN(number)){
      warnings.push(line);
      continue;
    }

    const trimmedName = name.trim();
    entries.push({
      quantity,
      name: trimmedName,
      setCode: setCode.toUpperCase(),
      number,
      isBasicEnergy: BASIC_ENERGY_RE.test(trimmedName),
      raw: line
    });
  }

  return { entries, warnings };
}
