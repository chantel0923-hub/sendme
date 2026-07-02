import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pidlanyedgieiyxuipwf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpZGxhbnllZGdpZWl5eHVpcHdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzI0MTMsImV4cCI6MjA5NTkwODQxM30.siEXY0HnLRTpx60qDjMMlRFj-Mxere-XNQiAfCy2Xjo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
