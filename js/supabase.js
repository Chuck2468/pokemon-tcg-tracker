import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://udlspjbatatzjijaphvx.supabase.co";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbHNwamJhdGF0emppamFwaHZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MTE3NDUsImV4cCI6MjEwMDQ4Nzc0NX0.oocYAEwKdSkFsRm-oJg28_k6G0kh4o4aJLsINIqpV1c";

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);