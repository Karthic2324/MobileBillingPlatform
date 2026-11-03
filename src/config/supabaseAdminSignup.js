import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';

// A second client that does NOT store a session. The controller uses it to create
// vendor accounts without being logged out (signUp on the main client would switch
// the logged-in user to the new vendor).
export const signupClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
