import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui";
import { startAssessment } from "@/app/onboarding/actions";
import { startDailyPractice } from "@/app/practice/actions";
import { ASSESSMENT_CATEGORIES, type AssessmentCategory } from "@/lib/assessment/types";

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

type DisciplineRow = {
  category: string;
  xp_earned: number;
  total_answered: number;
  total_correct: number;
  mastery_status: string;
};

function toCategory(value: string): AssessmentCategory | null {
  return (ASSESSMENT_CATEGORIES as readonly string[]).includes(value)
    ? (value as AssessmentCategory)
    : null;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const today = isoToday();
  const weekStart = new Date();
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const weekStartIso = weekStart.toISOString().slice(0, 10);

  const [{ data: profile }, { data: latestAssessment }, { data: inProgressSession }, { data: todayProgress }, { data: disciplineRows }, { data: lastPracticeSession }, { data: socialRows }, { data: weeklyRows }, { count: openMistakesCount }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("username, full_name, experience_level, role_focus, bio, avatar_url")
        .eq("id", user.id)
        .single(),
      supabase
        .from("assessment_attempts")
        .select("id, total_correct, total_questions, status, completed_at")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("practice_sessions")
        .select("id, started_at")
        .eq("user_id", user.id)
        .eq("status", "in_progress")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("user_daily_progress")
        .select("xp_earned, sessions_completed, current_streak, goal_target_xp, goal_met")
        .eq("user_id", user.id)
        .eq("day_date", today)
        .maybeSingle(),
      supabase
        .from("user_discipline_progress")
        .select("category, xp_earned, total_answered, total_correct, mastery_status")
        .eq("user_id", user.id),
      supabase
        .from("practice_sessions")
        .select("id, correct_count, total_questions, xp_earned, completed_at")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("friendships")
        .select("user_a, user_b")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
      supabase
        .from("user_daily_progress")
        .select("xp_earned, day_date")
        .eq("user_id", user.id)
        .gte("day_date", weekStartIso),
      supabase
        .from("user_missed_questions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "open"),
    ]);

  const mappedDiscipline = new Map<AssessmentCategory, DisciplineRow>();
  (disciplineRows || []).forEach((row) => {
    const category = toCategory(String(row.category || ""));
    if (!category) return;

    mappedDiscipline.set(category, {
      category,
      xp_earned: Number(row.xp_earned || 0),
      total_answered: Number(row.total_answered || 0),
      total_correct: Number(row.total_correct || 0),
      mastery_status: String(row.mastery_status || "Emerging"),
    });
  });

  const disciplineList = ASSESSMENT_CATEGORIES.map((category) => {
    const row = mappedDiscipline.get(category);
    const total = row?.total_answered || 0;
    const correct = row?.total_correct || 0;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    return {
      category,
      xp: row?.xp_earned || 0,
      total,
      correct,
      accuracy,
      mastery: row?.mastery_status || "Emerging",
      progressPercent: Math.max(8, Math.min(100, Math.round(((row?.xp_earned || 0) / 600) * 100))),
    };
  });

  const weakAreas = disciplineList
    .filter((item) => item.total > 0)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);

  const strongestAreas = disciplineList
    .filter((item) => item.total > 0)
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 2);

  const displayName = profile?.full_name || profile?.username || "Filmmaker";
  const avatarUrl = profile?.avatar_url || "";
  const roleFocus = profile?.role_focus || "Not set";
  const experienceLevel = profile?.experience_level || "Not set";
  const bio =
    profile?.bio ||
    "Build your visual identity: add your role focus, strengths, and what you want to improve next.";

  const assessmentScore = latestAssessment?.total_questions
    ? `${latestAssessment.total_correct}/${latestAssessment.total_questions}`
    : "Not taken";
  const assessmentPct = latestAssessment?.total_questions
    ? Math.round((latestAssessment.total_correct / latestAssessment.total_questions) * 100)
    : 0;

  const xpToday = Number(todayProgress?.xp_earned || 0);
  const sessionsToday = Number(todayProgress?.sessions_completed || 0);
  const streak = Number(todayProgress?.current_streak || 0);
  const dailyGoalTarget = Number(todayProgress?.goal_target_xp || 50);
  const dailyGoalPct = Math.max(0, Math.min(100, Math.round((xpToday / dailyGoalTarget) * 100)));
  const weeklyXp = (weeklyRows || []).reduce((sum, row) => sum + Number(row.xp_earned || 0), 0);

  const hasInProgress = Boolean(inProgressSession?.id);
  const friendsCount = socialRows?.length || 0;
  const totalDisciplineXp = disciplineList.reduce((sum, item) => sum + item.xp, 0);
  const openMistakes = Number(openMistakesCount || 0);

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
                Assessment
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
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Today</p>
          <h2 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight md:text-5xl">Welcome back, {displayName}</h2>
          <p className="mt-3 max-w-3xl text-base text-muted">
            Short, focused cinematography practice designed for daily momentum, stronger recall, and set-ready decisions.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <form action={startDailyPractice}>
              <button className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-[#13100a]">
                {hasInProgress ? "Continue Daily Practice" : "Start Daily Practice"}
              </button>
            </form>
            <Link
              href="/practice/review"
              className="rounded-xl border border-border bg-[#1a1b1f] px-5 py-2.5 text-sm font-semibold transition hover:bg-[#22252b]"
            >
              Review mistakes {openMistakes > 0 ? `(${openMistakes})` : ""}
            </Link>

            {hasInProgress ? (
              <form action={startDailyPractice}>
                <input type="hidden" name="forceNew" value="1" />
                <button className="rounded-xl border border-border bg-[#1a1b1f] px-5 py-2.5 text-sm font-semibold transition hover:bg-[#22252b]">
                  Start fresh session
                </button>
              </form>
            ) : (
              <form action={startAssessment}>
                <input type="hidden" name="forceNew" value="1" />
                <button className="rounded-xl border border-border bg-[#1a1b1f] px-5 py-2.5 text-sm font-semibold transition hover:bg-[#22252b]">
                  Retake assessment
                </button>
              </form>
            )}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-[#1b1c20] px-4 py-3">
              <p className="text-xs text-muted">XP today</p>
              <p className="mt-1 text-xl font-semibold">{xpToday}</p>
            </div>
            <div className="rounded-xl border border-border bg-[#1b1c20] px-4 py-3">
              <p className="text-xs text-muted">Daily streak</p>
              <p className="mt-1 text-xl font-semibold">{streak} days</p>
            </div>
            <div className="rounded-xl border border-border bg-[#1b1c20] px-4 py-3">
              <p className="text-xs text-muted">Sessions today</p>
              <p className="mt-1 text-xl font-semibold">{sessionsToday}</p>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-border bg-[#1b1c20] px-4 py-3">
            <p className="text-xs text-muted">Weekly XP</p>
            <p className="mt-1 text-xl font-semibold">{weeklyXp}</p>
          </div>

          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs text-muted">
              <span>Daily goal</span>
              <span>
                {xpToday}/{dailyGoalTarget} XP
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-accent" style={{ width: `${dailyGoalPct}%` }} />
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-[#16171a] p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-2xl font-semibold">Next recommended training</h3>
                {lastPracticeSession?.id ? (
                  <Link
                    href={`/practice/results?session=${encodeURIComponent(String(lastPracticeSession.id))}`}
                    className="rounded-lg border border-border bg-[#1a1b1f] px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-[#22252b]"
                  >
                    Review missed
                  </Link>
                ) : null}
              </div>

              {weakAreas.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {weakAreas.map((item) => (
                    <span key={item.category} className="rounded-full border border-border bg-[#1f2126] px-3 py-1 text-sm text-muted">
                      {item.category}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">No weak-area data yet. Complete your first daily practice to unlock targeted training.</p>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-[#16171a] p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-2xl font-semibold">Discipline progression</h3>
                <span className="text-xs uppercase tracking-[0.16em] text-muted">6 tracks</span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {disciplineList.map((item) => (
                  <div key={item.category} className="rounded-xl border border-border bg-[#1b1c20] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-base font-semibold">{item.category}</p>
                      <span className="rounded-full border border-border bg-[#21242a] px-2.5 py-0.5 text-xs text-muted">
                        {item.mastery}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {item.correct}/{item.total || 0} correct · {item.accuracy}% accuracy · {item.xp} XP
                    </p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${item.progressPercent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-[#16171a] p-6">
              <h3 className="text-2xl font-semibold">Recent activity</h3>
              <div className="mt-4 divide-y divide-white/10 rounded-xl border border-border bg-[#1b1c20]">
                <div className="px-4 py-3 text-sm text-[#dcdee5]">
                  {lastPracticeSession?.completed_at
                    ? `Completed daily practice (+${lastPracticeSession.xp_earned} XP, ${lastPracticeSession.correct_count}/${lastPracticeSession.total_questions})`
                    : "No completed daily practice yet"}
                </div>
                <div className="px-4 py-3 text-sm text-[#dcdee5]">
                  {latestAssessment?.completed_at
                    ? `Latest assessment baseline: ${assessmentScore}`
                    : "Assessment baseline not completed yet"}
                </div>
                <div className="px-4 py-3 text-sm text-[#dcdee5]">{friendsCount} social connection(s)</div>
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
              <p className="mt-1 text-sm text-[#d7d9e0]">Experience: {experienceLevel}</p>

              <Link
                href="/profile"
                className="mt-5 inline-flex rounded-xl border border-border bg-[#1a1b1f] px-3 py-2 text-sm font-semibold transition hover:bg-[#22252b]"
              >
                Open profile studio
              </Link>
            </section>

            <section className="rounded-2xl border border-border bg-[#16171a] p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Learning baseline</p>
              <p className="mt-3 text-3xl font-semibold">{assessmentScore}</p>
              <p className="mt-2 text-sm text-muted">Assessment confidence: {assessmentPct}%</p>
              {strongestAreas.length > 0 ? (
                <p className="mt-3 text-sm text-muted">
                  Strongest: {strongestAreas.map((item) => item.category).join(" · ")}
                </p>
              ) : null}
            </section>

            <section className="rounded-2xl border border-border bg-[#16171a] p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Progress totals</p>
              <p className="mt-3 text-3xl font-semibold">{totalDisciplineXp} XP</p>
              <p className="mt-2 text-sm text-muted">Total accumulated craft XP across all six disciplines.</p>
            </section>
          </aside>
        </section>
      </Container>
    </main>
  );
}
