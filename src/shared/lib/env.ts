import { z } from 'zod';

const schema = z
  .object({
    VITE_SUPABASE_URL: z.string().url(),
    // Supabase renamed "anon key" to "publishable key" — support both names
    VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
    VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  })
  .transform((v) => ({
    VITE_SUPABASE_URL: v.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: v.VITE_SUPABASE_ANON_KEY ?? v.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
  }))
  .refine((v) => v.VITE_SUPABASE_ANON_KEY.length > 0, {
    message: 'Set VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY in .env.local',
  });

export const env = schema.parse(import.meta.env);
