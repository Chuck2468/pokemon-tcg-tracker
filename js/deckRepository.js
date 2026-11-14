import { supabase } from "./supabase.js";

// Las operaciones de escritura devuelven {ok, message}: si el trigger de
// Supabase rechaza algo (p.ej. más copias de las que tienes), `message` trae el
// texto del error para enseñárselo al admin.
function result(error, extra = {}) {
  if (error) {
    console.error(error);
    return { ok: false, message: error.message };
  }
  return { ok: true, ...extra };
}

export const deckRepository = {
  // Devuelve solo las cartas que tienen alguna copia asignada a un mazo
  // (normalmente unas pocas filas). El total de cada carta ya lo tenemos en
  // state.cache, así que "disponibles = total - en mazos" se calcula en el
  // cliente y no hace falta traer todo el inventario otra vez.
  async getInDecks() {
    const { data, error } = await supabase
      .from("card_availability")
      .select("collection, card_id, normal_in_decks, reverse_in_decks, holo_in_decks, fullart_in_decks")
      .or("normal_in_decks.gt.0,reverse_in_decks.gt.0,holo_in_decks.gt.0,fullart_in_decks.gt.0");

    if (error) {
      console.error(error);
      return [];
    }

    return data;
  },

  // ---- Solo admin (las políticas RLS lo exigen) ----

  // Mazos con sus cartas: [{id, name, cards: [{id, collection, card_id, variant, qty}]}]
  async getDecks() {
    const { data, error } = await supabase
      .from("decks")
      .select("id, name, created_at, deck_cards(id, collection, card_id, variant, qty)")
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      return [];
    }

    return data.map(d => ({ id: d.id, name: d.name, cards: d.deck_cards || [] }));
  },

  async createDeck(name) {
    const { data, error } = await supabase
      .from("decks")
      .insert({ name })
      .select("id")
      .single();
    return result(error, { id: data?.id });
  },

  async deleteDeck(id) {
    const { error } = await supabase.from("decks").delete().eq("id", id);
    return result(error);
  },

  async addCard(deckId, collection, cardId, variant, qty) {
    const { error } = await supabase
      .from("deck_cards")
      .insert({ deck_id: deckId, collection, card_id: cardId, variant, qty });
    return result(error);
  },

  // Se actualiza por id de fila (no con upsert): el trigger de validación
  // contaría dos veces la fila existente en un upsert.
  async setQty(rowId, qty) {
    const { error } = await supabase.from("deck_cards").update({ qty }).eq("id", rowId);
    return result(error);
  },

  async removeCard(rowId) {
    const { error } = await supabase.from("deck_cards").delete().eq("id", rowId);
    return result(error);
  }
};
