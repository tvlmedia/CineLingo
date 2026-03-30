import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui";
import { startAssessment } from "@/app/onboarding/actions";

const DISCIPLINES = [
  "Technical Fundamentals",
  "Lighting Craft",
  "Visual Language",
  "Set & Production Knowledge",
  "Cinematic Reading",
  "Lens & Camera Intuition",
];

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, full_name, experience_level, role_focus, bio, avatar_url")
    .eq("id", user.id)
    .single();

  const { data: latestAttempt } = await supabase
    .from("assessment_attempts")
    .select("id, total_correct, total_questions, status, completed_at")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: socialRows } = await supabase
    .from("friendships")
    .select("user_a, user_b")
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);

  const displayName = profile?.full_name || profile?.username || "Filmmaker";
  const roleFocus = profile?.role_focus || "Not set";
  const experienceLevel = profile?.experience_level || "Not set";
  const bio = profile?.bio || "Add a short bio so future collaborators understand your visual approach.";
  const avatarUrl = profile?.avatar_url || "";

  const scoreValue = latestAttempt?.total_questions
    ? `${latestAttempt.total_correct}/${latestAttempt.total_questions}`
    : "Not taken";
  const assessmentPercent =
    latestAttempt?.total_questions && latestAttempt.total_questions > 0
      ? Math.round((latestAttempt.total_correct / latestAttempt.total_questions) * 100)
      : 0;

  const friendsCount = socialRows?.length || 0;

  const recentActivity = [
    latestAttempt?.status === "completed"
      ? `Completed intake assessment (${scoreValue})`
      : "No completed assessment yet",
    `Role focus: ${roleFocus}`,
    friendsCount > 0 ? `${friendsCount} social connection(s)` : "No social connections yet",
  ];

  return (
    <main className="min-h-screen py-8 md:py-10">
      <Container>
        <header className="mb-7 rounded-2xl border border-border bg-[#151619] px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted">CineLingo</p>
              <h1 className="mt-1 text-3xl font-semibold md:text-4xl">Studio Dashboard</h1>
            </div>
            <nav className="flex flex-wrap gap-2">
              <Link
                href="/dashboard"
                className="rounded-xl border border-border bg-[#202228] px-3 py-2 text-sm font-semibold"
              >
                Dashboard
              </Link>
              <Link
                href="/onboarding"
                className="rounded-xl border border-border bg-[#17181c] px-3 py-2 text-sm font-semibold transition hover:bg-[#212329]"
              >
                Learning
              </Link>
              <Link
                href="/social"
                className="rounded-xl border border-border bg-[#17181c] px-3 py-2 text-sm font-semibold transition hover:bg-[#212329]"
              >
                Social
              </Link>
              <Link
                href="/profile"
                className="rounded-xl border border-border bg-[#17181c] px-3 py-2 text-sm font-semibold transition hover:bg-[#212329]"
              >
                Profile
              </Link>
              <form action="/logout" method="post">
                <button className="rounded-xl border border-border bg-[#17181c] px-3 py-2 text-sm font-semibold transition hover:bg-[#212329]">
                  Log out
                </button>
              </form>
            </nav>
          </div>
        </header>

        <section className="mb-7 rounded-2xl border border-border bg-[#16171a] p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Learning Hub</p>
          <h2 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight md:text-5xl">Welcome back, {displayName}</h2>
          <p className="mt-3 max-w-3xl text-base text-muted">
            Build technical confidence, visual judgment, and set-ready decision speed with structured cinematography training.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/onboarding"
              className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-[#13100a]"
            >
              Continue learning
            </Link>
            <form action={startAssessment}>
              <input type="hidden" name="forceNew" value="1" />
              <button className="rounded-xl border border-border bg-[#1a1b1f] px-5 py-2.5 text-sm font-semibold transition hover:bg-[#22252b]">
                Retake assessment
              </button>
            </form>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-[#16171a] p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-2xl font-semibold">Progress</h3>
                <span className="rounded-full border border-border bg-[#1f2126] px-3 py-1 text-xs text-muted">
                  {assessmentPercent}% baseline
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-[#1c1e23] px-4 py-3">
                  <p className="text-xs text-muted">Assessment</p>
                  <p className="mt-1 text-lg font-semibold">{scoreValue}</p>
                </div>
                <div className="rounded-xl border border-border bg-[#1c1e23] px-4 py-3">
                  <p className="text-xs text-muted">Experience</p>
                  <p className="mt-1 text-lg font-semibold">{experienceLevel}</p>
                </div>
                <div className="rounded-xl border border-border bg-[#1c1e23] px-4 py-3">
                  <p className="text-xs text-muted">Network</p>
                  <p className="mt-1 text-lg font-semibold">{friendsCount} peers</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-[#16171a] p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-2xl font-semibold">Six Disciplines</h3>
                <span className="text-xs uppercase tracking-[0.16em] text-muted">Core framework</span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {DISCIPLINES.map((discipline) => (
                  <div
                    key={discipline}
                    className="rounded-xl border border-border bg-[#1b1c20] px-4 py-4 transition hover:bg-[#22242a]"
                  >
                    <p className="text-base font-semibold">{discipline}</p>
                    <p className="mt-1 text-sm text-muted">Lessons, case prompts, and craft drills</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-[#16171a] p-6">
              <h3 className="text-2xl font-semibold">Recent activity</h3>
              <div className="mt-4 divide-y divide-white/10 rounded-xl border border-border bg-[#1b1c20]">
                {recentActivity.map((item, index) => (
                  <div key={`${item}-${index}`} className="px-4 py-3">
                    <p className="text-sm text-[#dcdee5]">{item}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-border bg-[#16171a] p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Profile snapshot</p>
              <div className="mt-4 flex items-center gap-3">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="h-14 w-14 rounded-xl border border-border object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-[#1d1f24] text-lg font-semibold">
                    {displayName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-semibold">{displayName}</p>
                  <p className="text-sm text-muted">@{profile?.username || "user"}</p>
                </div>
              </div>

              <p className="mt-4 text-sm text-muted">{bio}</p>
              <p className="mt-3 text-sm text-[#d7d9e0]">Role focus: {roleFocus}</p>

              <Link
                href="/profile"
                className="mt-5 inline-flex rounded-xl border border-border bg-[#1a1b1f] px-3 py-2 text-sm font-semibold transition hover:bg-[#22252b]"
              >
                Open profile studio
              </Link>
            </section>

            <section className="rounded-2xl border border-border bg-[#16171a] p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Assessment</p>
              <p className="mt-3 text-3xl font-semibold">{scoreValue}</p>
              <p className="mt-2 text-sm text-muted">
                {latestAttempt?.status === "completed" ? "Latest baseline score" : "No completed baseline yet"}
              </p>
              {latestAttempt?.completed_at ? (
                <p className="mt-2 text-xs text-muted">
                  Updated {new Date(String(latestAttempt.completed_at)).toLocaleDateString()}
                </p>
              ) : null}
            </section>

            <section className="rounded-2xl border border-border bg-[#16171a] p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Social</p>
              <p className="mt-3 text-3xl font-semibold">{friendsCount}</p>
              <p className="mt-2 text-sm text-muted">Active connections</p>
              <Link
                href="/social"
                className="mt-4 inline-flex rounded-xl border border-border bg-[#1a1b1f] px-3 py-2 text-sm font-semibold transition hover:bg-[#22252b]"
              >
                Open network
              </Link>
            </section>
          </aside>
        </section>
      </Container>
    </main>
  );
}
