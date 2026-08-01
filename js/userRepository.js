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
  }
};