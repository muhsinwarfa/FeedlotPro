import { createBrowserClient } from '@supabase/ssr';

// NOTE: The <Database> generic is omitted here because the types in types/database.ts
// are hand-crafted. Once Supabase CLI is linked, replace with:
//   import type { Database } from '@/types/database';
//   return createBrowserClient<Database>(...)
// and run: npx supabase gen types typescript --project-id gqfjrkkwcgagcatnrizk > types/database.ts

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
