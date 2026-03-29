import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, Container } from "@/components/ui";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, full_name, experience_level, role_focus")
    .eq("id", user.id)
    .single();

  return (
    <main className="min-h-screen py-16">
      <Container>
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted">Dashboard</p>
            <h1 className="text-4xl font-bold">
              Welcome {profile?.full_name || profile?.username || "filmmaker"}
            </h1>
          </div>
          <form action="/logout" method="post">
            <button className="rounded-2xl border border-border px-4 py-3 font-semibold">
              Log out
            </button>
          </form>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <Card>
            <h2 className="mb-2 text-xl font-semibold">Profile</h2>
            <p className="mb-4 text-muted">Edit your role, level and identity inside CineLingo.</p>
            <Link href="/profile" className="font-semibold text-accent">
              Go to profile
            </Link>
          </Card>

          <Card>
            <h2 className="mb-2 text-xl font-semibold">Onboarding</h2>
            <p className="mb-4 text-muted">Start your intake test later to get a personal learning path.</p>
            <Link href="/onboarding" className="font-semibold text-accent">
              Open onboarding
            </Link>
          </Card>

          <Card>
            <h2 className="mb-2 text-xl font-semibold">Current level</h2>
            <p className="text-muted">
              {profile?.experience_level || "Not set yet"}
            </p>
          </Card>
        </div>
      </Container>
    </main>
  );
}
