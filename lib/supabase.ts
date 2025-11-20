import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = 'https://nrcnnduqkelbojkxkjsg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yY25uZHVxa2VsYm9qa3hranNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MTA0OTQsImV4cCI6MjA3OTE4NjQ5NH0.U7ACV1j9Orw33fmbNWDamvT9kQW-ZQPZG-cNppoAaCI';

export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: undefined,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
