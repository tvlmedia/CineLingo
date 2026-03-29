import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, Container } from "@/components/ui";

export default async function SocialPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, username")
    .eq("id", user.id)
    .single();

  const displayName = profile?.full_name || profile?.username || "Filmmaker";

  return (
    <main className="min-h-screen py-10 md:py-14">
      <Container>
        <header className="mb-8 rounded-3xl border border-border bg-card px-4 py-4 shadow-[0_24px_60px_rgba(1,7,18,0.4)] backdrop-blur-sm md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted">CineLingo Social</p>
              <h1 className="text-3xl font-bold md:text-4xl">Hey {displayName}</h1>
            </div>
            <Link
              href="/dashboard"
              className="rounded-2xl border border-border bg-white/5 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/10"
            >
              Back to dashboard
            </Link>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <h2 className="mb-2 text-2xl font-semibold">Friends & Invites</h2>
            <p className="mb-4 text-muted">
              Soon: search by username, send invites, and build your filmmaking circle.
            </p>
            <p className="text-sm text-muted">Status: UI ready, backend linking next.</p>
          </Card>

          <Card>
            <h2 className="mb-2 text-2xl font-semibold">Study Rooms</h2>
            <p className="mb-4 text-muted">
              Soon: shared challenge rooms where you compare answers and break down visual choices together.
            </p>
            <p className="text-sm text-muted">Status: coming after friends model.</p>
          </Card>
        </div>
      </Container>
    </main>
  );
}
