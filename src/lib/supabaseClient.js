import { createClient } from '@supabase/supabase-js';

// Reads from .env.local (see .env.example) when present, falling back to the
// existing project so this keeps working with zero setup. Set real env vars
// per-environment (dev/staging/prod) once more than one Supabase project exists.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jtyfkglqkklgmewyjpde.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable__s4STCV4LT07PBtz4gYubA_E0ZQAMt6';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
