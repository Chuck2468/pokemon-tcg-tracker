export const TYPE_COLORS = {
  "Pokémon": "var(--poke)",
  "Objeto": "var(--objeto)",
  "Herramienta": "var(--herramienta)",
  "Estadio": "var(--estadio)",
  "Partidario": "var(--partidario)",
  "Energía": "var(--energia)"
};
export const TYPE_SOFT = {
  "Pokémon": "var(--poke-soft)",
  "Objeto": "var(--objeto-soft)",
  "Herramienta": "var(--herramienta-soft)",
  "Estadio": "var(--estadio-soft)",
  "Partidario": "var(--partidario-soft)",
  "Energía": "var(--energia-soft)"
};
export const TYPES = ["Pokémon","Objeto","Herramienta","Estadio","Partidario","Energía"];

// Tipos elementales Pokémon (campo card.energia). Filtro "Tipo" nuevo,
// independiente de TYPES de arriba (que es la categoría de carta:
// Pokémon/Objeto/Herramienta/Estadio/Partidario/Energía). Solo tiene
// efecto sobre cartas de categoría "Pokémon"; en el resto de categorías el
// filtro se muestra pero no hace nada (ver filteredCards en
// collectionsService.js y las secciones equivalentes en app.js).
export const ENERGY_TYPES = ["Planta","Fuego","Agua","Eléctrico","Psíquico","Lucha","Siniestro","Acero","Hada","Dragón","Normal"];
export const ENERGY_TYPE_COLORS = {
  "Planta": "var(--etype-planta)",
  "Fuego": "var(--etype-fuego)",
  "Agua": "var(--etype-agua)",
  "Eléctrico": "var(--etype-electrico)",
  "Psíquico": "var(--etype-psiquico)",
  "Lucha": "var(--etype-lucha)",
  "Siniestro": "var(--etype-siniestro)",
  "Acero": "var(--etype-acero)",
  "Hada": "var(--etype-hada)",
  "Dragón": "var(--etype-dragon)",
  "Normal": "var(--etype-normal)"
};
export const ENERGY_TYPE_SOFT = {
  "Planta": "var(--etype-planta-soft)",
  "Fuego": "var(--etype-fuego-soft)",
  "Agua": "var(--etype-agua-soft)",
  "Eléctrico": "var(--etype-electrico-soft)",
  "Psíquico": "var(--etype-psiquico-soft)",
  "Lucha": "var(--etype-lucha-soft)",
  "Siniestro": "var(--etype-siniestro-soft)",
  "Acero": "var(--etype-acero-soft)",
  "Hada": "var(--etype-hada-soft)",
  "Dragón": "var(--etype-dragon-soft)",
  "Normal": "var(--etype-normal-soft)"
};

export const VARIANTS = [
  {key:"normal", label:"N", name:"Normal", short:"Normal", color:"var(--v-normal)"},
  {key:"reverse", label:"R", name:"Reverse", short:"Reverse", color:"var(--v-reverse)"},
  {key:"holo", label:"H", name:"Holográfica", short:"HOLO", color:"var(--v-holo)"},
  {key:"fullart", label:"FA", name:"FullArt", short:"FullArt", color:"var(--v-fullart)"}
];

