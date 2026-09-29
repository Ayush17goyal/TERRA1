import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 
  (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL : undefined) 
  || (import.meta as any).env?.VITE_SUPABASE_URL 
  || (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_URL
  || 'https://mydrikssmzzudzqeqroe.supabase.co';

const supabaseAnonKey = 
  (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined)
  || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY
  || (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZHJpa3NzbXp6dWR6cWVxcm9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NjYyNjIsImV4cCI6MjA5NjU0MjI2Mn0.Nvqw1uuNa95yunYiBqXLUoJ7tRFkjjUrWoCXeV_8XIc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
