import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pidlanyedgieiyxuipwf.supabase.co';
const SUPABASE_KEY = 'YOUR_ANON_KEY_HERE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
