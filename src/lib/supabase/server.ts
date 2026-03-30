import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createClient() {
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        name: "cinelingo-auth",
        path: "/",
        sameSite: "lax",
        secure: isProduction,
        httpOnly: false,
        maxAge: 60 * 60 * 24 * 365,
      },
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
            // ignore in Server Components where set is not available
          }
        },
      },
    }
  );
}
