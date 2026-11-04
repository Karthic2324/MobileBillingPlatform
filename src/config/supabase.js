import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'YOUR SUPABASE URL';
export const SUPABASE_ANON_KEY = 'YOUR SUPABASE KEY'; // Paste your full copied key here

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
