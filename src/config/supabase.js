import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kmtyazlvkzxuwasgthkw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qBHxeQrZpFDmpM93F1UxQQ_J-0Of4TD'; // Paste your full copied key here

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);