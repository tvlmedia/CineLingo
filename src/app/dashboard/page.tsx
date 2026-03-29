import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, Container } from "@/components/ui";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, full_name, experience_level, role_focus, bio")
    .eq("id", user.id)
    .single();
  const displayName = profile?.full_name || profile?.username || "Filmmaker";
  const roleFocus = profile?.role_focus || "Not set";
  const experienceLevel = profile?.experience_level || "Not set";
  const bio = profile?.bio || "Add a short bio so future collaborators know your style.";

  return (
    <main className="min-h-screen py-10 md:py-14">
      <Container>
        <header className="mb-8 rounded-3xl border border-border bg-card px-4 py-4 shadow-[0_24px_60px_rgba(1,7,18,0.4)] backdrop-blur-sm md:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted">CineLingo Hub</p>
              <h1 className="text-3xl font-bold md:text-4xl">{displayName}</h1>
            </div>

            <form action="/logout" method="post">
              <button className="rounded-2xl border border-border bg-white/5 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/10">
                Log out
              </button>
            </form>
          </div>

          <nav className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/dashboard"
              className="rounded-xl border border-accent bg-accent px-3 py-2 text-sm font-semibold text-[#04231d]"
            >
              Dashboard
            </Link>
            <Link
              href="/onboarding"
              className="rounded-xl border border-border bg-white/5 px-3 py-2 text-sm font-semibold transition hover:bg-white/10"
            >
              Learn
            </Link>
            <Link
              href="/social"
              className="rounded-xl border border-border bg-white/5 px-3 py-2 text-sm font-semibold transition hover:bg-white/10"
            >
              Social
            </Link>
            <Link
              href="/profile"
              className="rounded-xl border border-border bg-white/5 px-3 py-2 text-sm font-semibold transition hover:bg-white/10"
            >
              Profile
            </Link>
          </nav>
        </header>

        <section className="mb-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Card>
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted">Today</p>
            <h2 className="mb-3 text-3xl font-bold">Keep your cinematic eye sharp.</h2>
            <p className="mb-6 max-w-2xl text-muted">
              Train technical instincts and creative choices consistently. CineLingo tracks your growth while keeping the flow practical and visual.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/onboarding"
                className="rounded-2xl bg-accent px-4 py-2.5 font-semibold text-[#04231d] transition hover:brightness-105"
              >
                Continue learning
              </Link>
              <Link
                href="/social"
                className="rounded-2xl border border-border bg-white/5 px-4 py-2.5 font-semibold transition hover:bg-white/10"
              >
                Open social tab
              </Link>
            </div>
          </Card>

          <Card>
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted">Profile Snapshot</p>
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Role focus</p>
                <p className="text-lg font-semibold">{roleFocus}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Current level</p>
                <p className="text-lg font-semibold">{experienceLevel}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Bio</p>
                <p className="text-sm text-muted">{bio}</p>
              </div>
            </div>
          </Card>
        </section>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <Card>
            <h2 className="mb-2 text-xl font-semibold">Profile Studio</h2>
            <p className="mb-4 text-muted">Fine-tune identity, contact details and visual profile presence.</p>
            <Link href="/profile" className="font-semibold text-accent">
              Edit profile
            </Link>
          </Card>

          <Card>
            <h2 className="mb-2 text-xl font-semibold">Learning Path</h2>
            <p className="mb-4 text-muted">Take your intake and unlock tailored cinematography drills.</p>
            <Link href="/onboarding" className="font-semibold text-accent">
              Start onboarding
            </Link>
          </Card>

          <Card>
            <h2 className="mb-2 text-xl font-semibold">Social Wing</h2>
            <p className="mb-4 text-muted">Build your circle, compare growth and learn together.</p>
            <Link href="/social" className="font-semibold text-accent">
              Open social
            </Link>
          </Card>
        </div>
      </Container>
    </main>
  );
}
