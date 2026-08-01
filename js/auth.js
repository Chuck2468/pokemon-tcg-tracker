import { supabase } from "./supabase.js";

export const auth = {
  
async login() {
  return await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin + window.location.pathname,
      queryParams: {
        prompt: "select_account"
      }
    }
  });
  },

  async logout() {
    await supabase.auth.signOut();
  },

  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  async getUser() {
    const { data } = await supabase.auth.getUser();
    return data.user;
  },

  onAuthChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  }

};