import { COLLECTIONS } from "./data/collections.js";

export const INVENTORY_ID = "inventory";
export const DECKCHECK_ID = "deckcheck";
export const DAMAGECALC_ID = "damagecalc";

// Estado global compartido por toda la app. Se muta directamente desde los
// distintos módulos (no hay un sistema de acciones/reducers), así que cada
// módulo que lo importa está leyendo/escribiendo la misma instancia.
export const state = {
  activeId: COLLECTIONS[0].id,
  cache: {},           // collectionId -> array de cartas, o undefined si no está cargada aún
  search: "",
  activeType: "ALL",
  activeStatus: "ALL",
  onlyFullArt: false,  // filtro exclusivo del Inventario
  saveError: false,

  deckListText: "",     // texto pegado en el Comprobador de Mazos
  deckCheckResult: null, // resultado de la última comprobación (o null)

  // Calculadora de Daño: estado del ataque seleccionado (Ogerpon Máscara
  // Turquesa ex o Mega Meganium) y de sus variables de cálculo.
  damageCalc: {
    attacker: "ogerpon",   // "ogerpon" | "megameganium"
    myEnergy: 0,           // energías unidas al propio atacante
    rivalEnergy: 0,        // energías unidas al Pokémon rival (solo aplica a Ogerpon)
    meganiumBench: false,  // Meganium (no-Mega) en banca: las energías propias cuentan x2
    typeAdvantage: false,  // ventaja de tipo: daño total x2
    rivalHp: ""            // PS del rival, para calcular energías que faltan
  },

  mobileMenuOpen: null,  // "colecciones" | "herramientas" | "filtro" | null — panel abierto en la barra móvil inferior

  theme: "dark",   // "dark" | "light" — el valor real se fija al arrancar (ver theme.js/app.js), esto es solo el default antes de aplicarlo

  user: null
};
