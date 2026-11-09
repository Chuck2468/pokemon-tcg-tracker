import { supabase } from "./supabase.js";

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
  }
};
