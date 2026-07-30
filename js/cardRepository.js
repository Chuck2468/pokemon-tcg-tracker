import { supabase } from "./supabase.js";

export const storage = {
    async getCollection(collection) {
    const { data, error } = await supabase
        .from("collection_cards")
        .select("*")
        .eq("collection", collection);

    if (error) {
        console.error(error);
        return [];
    }

    return data;
    },
    async saveCard(collection, card) {
    const { error } = await supabase
        .from("collection_cards")
        .upsert({
            collection,
            card_id: card.id,
            normal: card.variantes.normal,
            reverse: card.variantes.reverse,
            holo: card.variantes.holo,
            fullart: card.variantes.fullart
        });
    if (error) {
        console.error(error);
        return false;
    }
    return true;
    }
};