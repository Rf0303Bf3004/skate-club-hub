import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://urbctwvdlovgodjpyiib.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyYmN0d3ZkbG92Z29kanB5aWliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzUwMjgsImV4cCI6MjA4ODY1MTAyOH0.Fgc8ZfvMvMhtTtTgTZ8ABHM-iVky3wqTnoTTvESQq8I';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const DEMO_CLUB_ID = '00000000-0000-0000-0000-000000000002';
