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
  const bio = profile?.bio || "Add a short bio so future collaborators know your style.";
  const avatarUrl = profile?.avatar_url || "";

  const scoreValue = latestAttempt?.total_questions
    ? `${latestAttempt.total_correct}/${latestAttempt.total_questions}`
    : "Not taken";
  const assessmentPercent =
    latestAttempt?.total_questions && latestAttempt.total_questions > 0
      ? Math.round((latestAttempt.total_correct / latestAttempt.total_questions) * 100)
      : 0;

  const friendsCount = socialRows?.length || 0;
  const readinessPercent = Math.max(18, Math.min(100, assessmentPercent + 10));

  const recentActivity = [
    latestAttempt?.status === "completed"
      ? `Completed intake assessment (${scoreValue})`
      : "No completed assessment yet",
    `Role focus set to: ${roleFocus}`,
    friendsCount > 0 ? `${friendsCount} social connection(s)` : "No social connections yet",
  ];

  return (
    <main className="min-h-screen py-8 md:py-12">
      <Container>
        <header className="mb-8 rounded-[30px] border border-[#2a3f66]/50 bg-[linear-gradient(150deg,rgba(8,20,46,0.96),rgba(6,17,38,0.92))] px-5 py-4 shadow-[0_30px_80px_rgba(2,6,18,0.55)] backdrop-blur md:px-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#92a9d0]">CineLingo Studio</p>
              <h1 className="text-3xl font-bold md:text-4xl">Dashboard</h1>
            </div>
            <nav className="flex flex-wrap gap-2">
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
              <form action="/logout" method="post">
                <button className="rounded-xl border border-border bg-white/5 px-3 py-2 text-sm font-semibold transition hover:bg-white/10">
                  Log out
                </button>
              </form>
            </nav>
          </div>
        </header>

        <section className="mb-6 rounded-[32px] border border-[#28406a]/45 bg-[linear-gradient(160deg,rgba(8,19,42,0.96),rgba(8,18,36,0.9))] p-6 shadow-[0_35px_90px_rgba(1,6,18,0.62)] md:p-8">
          <p className="text-xs uppercase tracking-[0.24em] text-[#8ca6d2]">Cinematography Learning Platform</p>
          <h2 className="mt-3 text-4xl font-bold leading-tight md:text-5xl">Welcome back, {displayName}</h2>
          <p className="mt-3 max-w-3xl text-[15px] text-[#b3c5e5]">
            Sharpen your technical precision and visual instincts with structured practice.
            CineLingo tracks growth across your full cinematography craft.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/onboarding"
              className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-[#03231d] shadow-[0_10px_40px_rgba(24,211,163,0.35)] transition hover:brightness-110"
            >
              Continue Learning
            </Link>
            <form action={startAssessment}>
              <input type="hidden" name="forceNew" value="1" />
              <button className="rounded-2xl border border-[#35507d] bg-[#0d1d3d] px-5 py-3 text-sm font-semibold transition hover:bg-[#11264d]">
                Retake Assessment
              </button>
            </form>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.8fr]">
          <div className="space-y-6">
            <div className="rounded-[28px] border border-[#294067]/45 bg-[linear-gradient(160deg,rgba(8,19,43,0.94),rgba(7,16,35,0.92))] p-6 shadow-[0_24px_70px_rgba(1,7,18,0.56)]">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#8fa9d2]">Learning Path</p>
                  <h3 className="mt-2 text-2xl font-semibold">Progress Overview</h3>
                </div>
                <span className="rounded-full border border-[#39527d] px-3 py-1 text-xs font-semibold text-[#d4e5ff]">
                  {assessmentPercent}% baseline
                </span>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs text-[#a9bfdf]">
                    <span>Assessment score</span>
                    <span>{scoreValue}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.max(6, assessmentPercent)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-xs text-[#a9bfdf]">
                    <span>Discipline readiness</span>
                    <span>{readinessPercent}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[#7ca5ff]"
                      style={{ width: `${Math.max(8, readinessPercent)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#2a426a] bg-[#101f40] px-4 py-3">
                  <p className="text-xs text-[#9db5dc]">Current level</p>
                  <p className="mt-1 text-base font-semibold">{experienceLevel}</p>
                </div>
                <div className="rounded-2xl border border-[#2a426a] bg-[#101f40] px-4 py-3">
                  <p className="text-xs text-[#9db5dc]">Role focus</p>
                  <p className="mt-1 truncate text-base font-semibold">{roleFocus}</p>
                </div>
                <div className="rounded-2xl border border-[#2a426a] bg-[#101f40] px-4 py-3">
                  <p className="text-xs text-[#9db5dc]">Crew network</p>
                  <p className="mt-1 text-base font-semibold">{friendsCount} peers</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-[#294067]/45 bg-[linear-gradient(160deg,rgba(7,17,39,0.94),rgba(8,18,37,0.92))] p-6 shadow-[0_24px_70px_rgba(1,7,18,0.56)]">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-2xl font-semibold">Six Core Disciplines</h3>
                <span className="rounded-full border border-[#3a5583] px-3 py-1 text-xs text-[#c8d9f4]">
                  Central Tracks
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {DISCIPLINES.map((discipline) => (
                  <div
                    key={discipline}
                    className="rounded-2xl border border-[#2a436d] bg-[#0f1f42] px-4 py-3 transition hover:border-[#4e73ab] hover:bg-[#132955]"
                  >
                    <p className="font-semibold">{discipline}</p>
                    <p className="mt-1 text-xs text-[#9fb5da]">Lessons, drills, and scenario training</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-[#294067]/45 bg-[linear-gradient(160deg,rgba(7,17,39,0.94),rgba(8,18,37,0.92))] p-6 shadow-[0_24px_70px_rgba(1,7,18,0.56)]">
              <h3 className="text-2xl font-semibold">Recent Activity</h3>
              <div className="mt-4 space-y-3">
                {recentActivity.map((item, index) => (
                  <div key={`${item}-${index}`} className="rounded-2xl border border-[#2b436d] bg-[#0f1f42] px-4 py-3">
                    <p className="text-sm text-[#d5e4ff]">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[28px] border border-[#294067]/45 bg-[linear-gradient(160deg,rgba(7,17,39,0.94),rgba(8,18,37,0.92))] p-6 shadow-[0_24px_70px_rgba(1,7,18,0.56)]">
              <p className="text-xs uppercase tracking-[0.2em] text-[#8fa9d2]">Profile Snapshot</p>
              <div className="mt-4 flex items-center gap-3">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="h-14 w-14 rounded-2xl border border-[#34527f] object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#34527f] bg-[#0f1f42] text-lg font-semibold">
                    {displayName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-semibold">{displayName}</p>
                  <p className="text-xs text-[#9fb5da]">@{profile?.username || "user"}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-[#b3c5e5]">{bio}</p>
              <Link href="/profile" className="mt-5 inline-flex rounded-xl border border-[#385683] px-3 py-2 text-sm font-semibold transition hover:bg-[#12264d]">
                Open profile studio
              </Link>
            </div>

            <div className="rounded-[28px] border border-[#294067]/45 bg-[linear-gradient(160deg,rgba(7,17,39,0.94),rgba(8,18,37,0.92))] p-6 shadow-[0_24px_70px_rgba(1,7,18,0.56)]">
              <p className="text-xs uppercase tracking-[0.2em] text-[#8fa9d2]">Assessment</p>
              <p className="mt-3 text-3xl font-bold">{scoreValue}</p>
              <p className="mt-1 text-sm text-[#9fb5da]">
                {latestAttempt?.status === "completed" ? "Latest baseline score" : "No completed baseline yet"}
              </p>
              {latestAttempt?.completed_at ? (
                <p className="mt-2 text-xs text-[#7f9cc7]">
                  Updated {new Date(String(latestAttempt.completed_at)).toLocaleDateString()}
                </p>
              ) : null}
            </div>

            <div className="rounded-[28px] border border-[#294067]/45 bg-[linear-gradient(160deg,rgba(7,17,39,0.94),rgba(8,18,37,0.92))] p-6 shadow-[0_24px_70px_rgba(1,7,18,0.56)]">
              <p className="text-xs uppercase tracking-[0.2em] text-[#8fa9d2]">Social Snapshot</p>
              <p className="mt-3 text-3xl font-bold">{friendsCount}</p>
              <p className="mt-1 text-sm text-[#9fb5da]">Active connections</p>
              <Link href="/social" className="mt-4 inline-flex rounded-xl border border-[#385683] px-3 py-2 text-sm font-semibold transition hover:bg-[#12264d]">
                Open social
              </Link>
            </div>
          </aside>
        </section>
      </Container>
    </main>
  );
}
