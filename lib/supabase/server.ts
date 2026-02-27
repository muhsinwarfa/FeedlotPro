import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// NOTE: The <Database> generic is omitted here because the types in types/database.ts
// are hand-crafted. Once Supabase CLI is linked, replace with:
//   import type { Database } from '@/types/database';
//   return createServerClient<Database>(...)
// and run: npx supabase gen types typescript --project-id gqfjrkkwcgagcatnrizk > types/database.ts

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — cookies can only be
            // set from middleware or a Route Handler. Safe to ignore here.
          }
        },
      },
    }
  );
}
