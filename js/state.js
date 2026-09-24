import { COLLECTIONS } from "./data/collections.js";

export const INVENTORY_ID = "inventory";
export const DECKCHECK_ID = "deckcheck";

// La Calculadora de Daño es una "familia" de herramientas: una por cada
// pareja de cartas (Mega + su pre-evolución). Cada pareja tiene su propio
// id de navegación y su propio hueco de estado en `state.damageCalc`, así
// que añadir una pareja nueva en el futuro es: un id más aquí, una entrada
// más en `damageCalc` de abajo, y su propia función renderDamageCalcXxx en
// app.js — sin tocar el resto de parejas ya existentes.
export const DAMAGECALC_MEGANIUM_ID = "damagecalc-meganium";
export const DAMAGECALC_CHANDELURE_ID = "damagecalc-chandelure";
export const DAMAGECALC_IDS = [DAMAGECALC_MEGANIUM_ID, DAMAGECALC_CHANDELURE_ID];

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

  // Calculadora de Daño: un hueco de estado por cada pareja de cartas (ver
  // DAMAGECALC_IDS arriba).
  damageCalc: {
    // Ogerpon Máscara Turquesa ex / Mega Meganium
    [DAMAGECALC_MEGANIUM_ID]: {
      attacker: "ogerpon",   // "ogerpon" | "megameganium"
      myEnergy: 0,           // energías unidas al propio atacante
      rivalEnergy: 0,        // energías unidas al Pokémon rival (solo aplica a Ogerpon)
      meganiumBench: false,  // Meganium (no-Mega) en banca: las energías propias cuentan x2
      typeAdvantage: false,  // ventaja de tipo: daño total x2
      rivalHp: ""            // PS del rival, para calcular energías que faltan
    },
    // Chandelure / Mega Chandelure
    [DAMAGECALC_CHANDELURE_ID]: {
      attacker: "chandelure",  // "chandelure" | "megachandelure"
      rivalHandCards: 0,       // cartas en la mano del rival (Chandelure): 0-60
      typeAdvantage: false,    // ventaja de tipo: daño total x2 (ambos atacantes)
      megaCount: 0,            // Mega Chandelure propios en banca (Mega Chandelure): 0-3, +1 al coste de retirada del rival cada uno
      retreatCost: 0,          // coste de retirada base del rival (Mega Chandelure): 0-5
      airBalloon: false        // Globo Helio del rival: -2 al coste de retirada total
    }
  },

  mobileMenuOpen: null,  // "colecciones" | "herramientas" | "filtro" | null — panel abierto en la barra móvil inferior

  theme: "dark",   // "dark" | "light" — el valor real se fija al arrancar (ver theme.js/app.js), esto es solo el default antes de aplicarlo

  user: null
};
