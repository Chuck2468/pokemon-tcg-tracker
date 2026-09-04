import { COLLECTIONS } from "./data/collections.js";

export const INVENTORY_ID = "inventory";
export const DECKCHECK_ID = "deckcheck";

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

  mobileMenuOpen: null,  // "colecciones" | "herramientas" | "filtro" | null — panel abierto en la barra móvil inferior

  theme: "dark",   // "dark" | "light" — el valor real se fija al arrancar (ver theme.js/app.js), esto es solo el default antes de aplicarlo

  user: null
};
