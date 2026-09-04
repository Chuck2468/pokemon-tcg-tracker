// Gestión del tema claro/oscuro. Todo el color de la app vive en variables
// CSS (:root en style.css); este módulo solo decide cuál de los dos
// conjuntos de variables aplicar y recuerda la preferencia del usuario. No
// toca `state` directamente (eso lo hace app.js) para mantener este módulo
// sin dependencias, igual que cardUtils.js.

const STORAGE_KEY = "pktcg-theme";

// Lee la preferencia guardada; si el usuario nunca ha tocado el interruptor,
// usa la preferencia del sistema operativo/navegador (prefers-color-scheme).
// localStorage puede fallar en navegación privada en algunos navegadores,
// así que se envuelve en try/catch y simplemente se ignora el guardado.
export function getPreferredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch (e) {
    // localStorage inaccesible: seguimos con la preferencia del sistema.
  }
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
    return "light";
  }
  return "dark";
}

// Aplica el tema al documento (activa las variables CSS correspondientes),
// actualiza el color de la barra de estado del navegador móvil, y guarda la
// preferencia para la próxima visita.
export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute("content", theme === "light" ? "#f4f6fb" : "#12141c");
  }

  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch (e) {
    // No pasa nada si no se puede guardar: simplemente no se recordará.
  }
}
