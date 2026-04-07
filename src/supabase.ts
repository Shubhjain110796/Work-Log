import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nldlvkssbsjubpbxkxma.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sZGx2a3NzYnNqdWJwYnhreG1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0Nzg2ODUsImV4cCI6MjA5MTA1NDY4NX0.d4VGOceJTf0MD8UCx_c2jJhAQfiUiGw9FNbEKkzEqpI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
