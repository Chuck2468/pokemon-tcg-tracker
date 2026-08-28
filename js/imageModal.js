// ---- Modal de imagen de carta ----
// El modal vive fuera de #root (se crea una sola vez y no se destruye en
// cada render), para no perder su estado ni tener que re-engancharle
// listeners cada vez que se redibuja la app.

function buildImageUrl(series, set, cardId){
  return `https://assets.tcgdex.net/es/${series}/${set}/${cardId}/high.webp`;
}

let imageModalEl = null;

function ensureImageModal(){
  if(imageModalEl) return imageModalEl;
  const modal = document.createElement("div");
  modal.id = "cardImageModal";
  modal.className = "image-modal hidden";
  modal.innerHTML = `
    <div class="image-modal-backdrop"></div>
    <div class="image-modal-content">
      <button class="image-modal-close" type="button" aria-label="Cerrar">×</button>
      <img id="cardImageModalImg" alt="Carta" />
    </div>`;
  document.body.appendChild(modal);

  modal.querySelector(".image-modal-backdrop").addEventListener("click", closeCardImage);
  modal.querySelector(".image-modal-close").addEventListener("click", closeCardImage);
  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape") closeCardImage();
  });

  imageModalEl = modal;
  return modal;
}

export function openCardImage(series, set, cardId){
  const modal = ensureImageModal();
  const img = modal.querySelector("#cardImageModalImg");
  img.src = buildImageUrl(series, set, cardId);
  modal.classList.remove("hidden");
}

export function closeCardImage(){
  if(!imageModalEl) return;
  imageModalEl.classList.add("hidden");
  const img = imageModalEl.querySelector("#cardImageModalImg");
  img.src = "";
}
