import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pidlanyedgieiyxuipwf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_QCYr1YvSishTG8IhyGcTTw_v-7bcyzI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);