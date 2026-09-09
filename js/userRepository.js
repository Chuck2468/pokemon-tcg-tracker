import { supabase } from "./supabase.js";

export const userRepository = {
  async getRole(userId) {
    const { data, error } = await supabase
      .from("authorized_users")
      .select("role")
      .eq("user_id", userId)
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      console.error(error);
      return null;
    }
    return data.role;
  },

  // Trae rol + avatar_id en una sola consulta (evita duplicar el select en
  // handleSession). avatar_id puede ser null si el admin aún no ha asignado
  // ninguno a este usuario; el llamador decide el avatar por defecto en ese caso.
  async getProfile(userId) {
    const { data, error } = await supabase
      .from("authorized_users")
      .select("role, avatar_id")
      .eq("user_id", userId)
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      console.error(error);
      return null;
    }
    return { role: data.role, avatarId: data.avatar_id };
  }
};