import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui";
import { startAssessment } from "@/app/onboarding/actions";
import { startDailyPractice } from "@/app/practice/actions";
import { ASSESSMENT_CATEGORIES, type AssessmentCategory } from "@/lib/assessment/types";
import { dueInMs, isReviewDueNow } from "@/lib/practice/review-schedule";
import { computeDailyQuestProgress, getDailyQuest } from "@/lib/practice/daily-quest";
import { computeDisciplineLevelProgress } from "@/lib/practice/levels";
import { PracticePrewarm } from "./PracticePrewarm";

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function diffDaysUtc(laterIso: string, earlierIso: string): number {
  const later = new Date(`${laterIso}T00:00:00.000Z`);
  const earlier = new Date(`${earlierIso}T00:00:00.000Z`);
  const diffMs = later.getTime() - earlier.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
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

function isAssessmentCategory(value: string): value is AssessmentCategory {
  return (ASSESSMENT_CATEGORIES as readonly string[]).includes(value);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = (await searchParams) || {};
  const error = String(params.error || "");
  const user = await requireUser();
  const supabase = await createClient();
  const today = isoToday();
  const weekStart = new Date();
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const weekStartIso = weekStart.toISOString().slice(0, 10);

  const [{ data: profile }, { data: latestAssessment }, { data: inProgressSession }, { data: todayProgress }, { data: disciplineRows }, { data: lastPracticeSession }, { data: socialRows }, { data: weeklyRows }, { data: missedQueueRows }, { data: learningProfile }, { data: todayCompletedSessions }, { data: recentFreezeSession }] =
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
        .select("id, correct_count, total_questions, xp_earned, completed_at, coach_summary, coach_next_focus")
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
        .select("id, miss_count, correct_review_count, last_missed_at, last_reviewed_at")
        .eq("user_id", user.id)
        .eq("status", "open")
        .limit(200),
      supabase
        .from("user_learning_profiles")
        .select("weak_subtopics, weakest_disciplines, strongest_disciplines")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("practice_sessions")
        .select("id, lesson_plan")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .eq("lesson_date", today),
      supabase
        .from("practice_sessions")
        .select("lesson_date")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .contains("lesson_plan", { streakFreezeApplied: true })
        .order("lesson_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const friendIds = Array.from(
    new Set(
      ((socialRows || []) as Array<{ user_a?: unknown; user_b?: unknown }>)
        .map((row) => {
          const userA = typeof row.user_a === "string" ? row.user_a : "";
          const userB = typeof row.user_b === "string" ? row.user_b : "";
          if (!userA || !userB) return "";
          return userA === user.id ? userB : userA;
        })
        .filter((value) => value.length > 0)
    )
  );

  const leaderboardUserIds = Array.from(new Set([user.id, ...friendIds]));
  const [{ data: leaderboardXpRows }, { data: leaderboardProfiles }] =
    leaderboardUserIds.length > 0
      ? await Promise.all([
          supabase
            .from("user_daily_progress")
            .select("user_id, xp_earned, day_date")
            .in("user_id", leaderboardUserIds)
            .gte("day_date", weekStartIso),
          supabase
            .from("profiles")
            .select("id, full_name, username, avatar_url")
            .in("id", leaderboardUserIds),
        ])
      : [{ data: [] }, { data: [] }];

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
    const xp = row?.xp_earned || 0;
    const levelProgress = computeDisciplineLevelProgress(xp);

    return {
      category,
      xp,
      total,
      correct,
      accuracy,
      mastery: row?.mastery_status || "Emerging",
      level: levelProgress.level,
      xpIntoLevel: levelProgress.xpIntoLevel,
      xpNeededForNextLevel: levelProgress.xpNeededForNextLevel,
      progressPercent: Math.max(6, levelProgress.progressPercent),
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
  const dailyGoalMet = Boolean(todayProgress?.goal_met) || xpToday >= dailyGoalTarget;
  const weeklyXp = (weeklyRows || []).reduce(
    (sum: number, row: { xp_earned?: unknown }) => sum + Number(row.xp_earned || 0),
    0
  );

  const hasInProgress = Boolean(inProgressSession?.id);
  const inProgressSessionId = typeof inProgressSession?.id === "string" ? inProgressSession.id : "";
  const canPrewarmAi = Boolean(process.env.OPENAI_API_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const friendsCount = socialRows?.length || 0;
  const weeklyXpByUser = new Map<string, number>();
  ((leaderboardXpRows || []) as Array<{ user_id?: unknown; xp_earned?: unknown }>).forEach((row) => {
    const userId = typeof row.user_id === "string" ? row.user_id : "";
    if (!userId) return;
    const current = weeklyXpByUser.get(userId) || 0;
    weeklyXpByUser.set(userId, current + Number(row.xp_earned || 0));
  });

  const profileByUserId = new Map<
    string,
    { fullName: string; username: string; avatarUrl: string }
  >();
  ((leaderboardProfiles || []) as Array<{ id?: unknown; full_name?: unknown; username?: unknown; avatar_url?: unknown }>).forEach((row) => {
    const id = typeof row.id === "string" ? row.id : "";
    if (!id) return;
    profileByUserId.set(id, {
      fullName: typeof row.full_name === "string" ? row.full_name : "",
      username: typeof row.username === "string" ? row.username : "",
      avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : "",
    });
  });

  const leaderboardEntries = leaderboardUserIds
    .map((id) => {
      const p = profileByUserId.get(id);
      const name = p?.fullName || p?.username || (id === user.id ? "You" : "Filmmaker");
      const username = p?.username || "";
      return {
        id,
        name,
        username,
        avatarUrl: p?.avatarUrl || "",
        xp: weeklyXpByUser.get(id) || 0,
      };
    })
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 8);

  const totalDisciplineXp = disciplineList.reduce(
    (sum: number, item: (typeof disciplineList)[number]) => sum + item.xp,
    0
  );
  const overallLevelProgress = computeDisciplineLevelProgress(totalDisciplineXp);
  const now = new Date();
  const missedQueue = ((missedQueueRows || []) as Array<{
    id?: unknown;
    miss_count?: unknown;
    correct_review_count?: unknown;
    last_missed_at?: unknown;
    last_reviewed_at?: unknown;
  }>).map((row) => {
    const state = {
      missCount: Number(row.miss_count || 0),
      correctReviewCount: Number(row.correct_review_count || 0),
      lastMissedAt: typeof row.last_missed_at === "string" ? row.last_missed_at : null,
      lastReviewedAt: typeof row.last_reviewed_at === "string" ? row.last_reviewed_at : null,
    };
    return {
      id: typeof row.id === "string" ? row.id : "",
      dueNow: isReviewDueNow(state, now),
      dueInMs: dueInMs(state, now),
    };
  });
  const openMistakes = missedQueue.length;
  const dueNowMistakes = missedQueue.filter((row) => row.dueNow).length;
  const nextDueMs = missedQueue
    .map((row) => row.dueInMs)
    .filter((value) => value > 0)
    .sort((a, b) => a - b)[0];
  const nextDueLabel =
    typeof nextDueMs === "number"
      ? nextDueMs <= 1000 * 60 * 60
        ? `${Math.ceil(nextDueMs / (1000 * 60))}m`
        : `${Math.ceil(nextDueMs / (1000 * 60 * 60))}h`
      : null;
  const missionPracticeDone = sessionsToday > 0;
  const missionReviewDone = dueNowMistakes === 0;
  const missionGoalDone = dailyGoalMet;
  const missionDoneCount =
    (missionPracticeDone ? 1 : 0) + (missionReviewDone ? 1 : 0) + (missionGoalDone ? 1 : 0);
  const isAdmin = String(user.email || "").toLowerCase() === "info@tvlmedia.nl";
  const weakestFromProfile = Array.isArray(learningProfile?.weakest_disciplines)
    ? learningProfile.weakest_disciplines.find(
        (entry): entry is AssessmentCategory =>
          typeof entry === "string" && isAssessmentCategory(entry)
      ) || null
    : null;
  const todayQuest = getDailyQuest({
    date: new Date(`${today}T00:00:00.000Z`),
    userId: user.id,
    weakestDiscipline: weakestFromProfile,
  });
  const todayCompletedSessionIds = ((todayCompletedSessions || []) as Array<{ id?: unknown }>)
    .map((row) => (typeof row.id === "string" ? row.id : ""))
    .filter((value) => value.length > 0);
  let weakCorrectToday = 0;
  if (todayQuest.metric === "weak_correct" && todayQuest.discipline && todayCompletedSessionIds.length > 0) {
    const { data: weakCorrectRows } = await supabase
      .from("practice_answers")
      .select("is_correct, question:assessment_questions(category)")
      .in("session_id", todayCompletedSessionIds)
      .eq("user_id", user.id)
      .eq("is_correct", true);

    weakCorrectToday = (weakCorrectRows || []).reduce(
      (sum: number, row: { question?: unknown }) => {
        const categoryRaw = String(
          (Array.isArray(row.question) ? row.question[0] : row.question)?.category || ""
        );
        return categoryRaw === todayQuest.discipline ? sum + 1 : sum;
      },
      0
    );
  }
  const todayQuestProgress = computeDailyQuestProgress(todayQuest, {
    xpToday,
    sessionsToday,
    weakCorrectToday,
  });
  const questRewardClaimed = ((todayCompletedSessions || []) as Array<{ lesson_plan?: unknown }>).some(
    (row) =>
      Boolean(
        row.lesson_plan &&
          typeof row.lesson_plan === "object" &&
          !Array.isArray(row.lesson_plan) &&
          (row.lesson_plan as Record<string, unknown>).dailyQuestRewardGranted
      )
  );
  const recentFreezeDate =
    recentFreezeSession && typeof recentFreezeSession.lesson_date === "string"
      ? recentFreezeSession.lesson_date
      : null;
  const freezeCooldownDays =
    recentFreezeDate && recentFreezeDate <= today
      ? Math.max(0, 7 - diffDaysUtc(today, recentFreezeDate))
      : 0;
  const streakFreezeReady = freezeCooldownDays === 0;
  const weakSubtopics = Array.isArray(learningProfile?.weak_subtopics)
    ? learningProfile.weak_subtopics.filter((entry): entry is string => typeof entry === "string").slice(0, 3)
    : [];

  return (
    <main className="min-h-screen py-8 md:py-10">
      <Container>
        <PracticePrewarm enabled={!hasInProgress && canPrewarmAi} />
        {error ? (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error === "practice_abandon_failed"
                ? "Could not close your previous session. Try again."
                : error === "practice_start_failed"
                  ? "Could not start a new practice session. Try again."
                  : error === "practice_ai_key_missing"
                    ? "OpenAI key is missing on the server. Add OPENAI_API_KEY in Vercel."
                    : error === "practice_ai_storage_unavailable"
                      ? "AI sessions need Supabase service role key. Add SUPABASE_SERVICE_ROLE_KEY in Vercel."
                    : error === "practice_ai_unavailable"
                      ? "AI session could not generate enough quality questions right now. Try again."
                    : error === "practice_questions_unavailable"
                      ? "No valid questions available right now."
                      : "Something went wrong while starting practice."}
          </div>
        ) : null}
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
              {isAdmin ? (
                <Link
                  href="/admin/questions"
                  className="rounded-xl border border-border bg-[#17181c] px-3 py-2 text-sm font-semibold transition hover:bg-[#212329]"
                >
                  Quality
                </Link>
              ) : null}
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

          <div className="relative z-20 mt-6 flex flex-wrap gap-3 pointer-events-auto">
            {hasInProgress && inProgressSessionId ? (
              <Link
                href={`/practice?session=${encodeURIComponent(inProgressSessionId)}&q=1`}
                className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-[#13100a]"
              >
                Continue Daily Practice
              </Link>
            ) : (
              <form action={startDailyPractice} className="pointer-events-auto">
                <input type="hidden" name="mode" value="adaptive" />
                <button
                  type="submit"
                  className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-[#13100a]"
                >
                  Start Daily Practice
                </button>
              </form>
            )}
            <form action={startDailyPractice} className="pointer-events-auto">
              <input type="hidden" name="forceNew" value="1" />
              <input type="hidden" name="mode" value="ai_only" />
              <button
                type="submit"
                className="rounded-xl border border-border bg-[#1a1b1f] px-5 py-2.5 text-sm font-semibold transition hover:bg-[#22252b]"
              >
                Start AI Coach Session
              </button>
            </form>
            <form action={startDailyPractice} className="pointer-events-auto">
              <input type="hidden" name="forceNew" value="1" />
              <input type="hidden" name="mode" value="recovery" />
              <button
                type="submit"
                className="rounded-xl border border-border bg-[#1a1b1f] px-5 py-2.5 text-sm font-semibold transition hover:bg-[#22252b]"
              >
                {dueNowMistakes > 0 ? `Start recovery sprint (${dueNowMistakes})` : "Start recovery sprint"}
              </button>
            </form>
            <form action={startDailyPractice} className="pointer-events-auto">
              <input type="hidden" name="forceNew" value="1" />
              <input type="hidden" name="mode" value="bank_only" />
              <button
                type="submit"
                className="rounded-xl border border-border bg-[#1a1b1f] px-5 py-2.5 text-sm font-semibold transition hover:bg-[#22252b]"
              >
                Start fresh session
              </button>
            </form>
            <Link
              href="/practice/review"
              className="pointer-events-auto rounded-xl border border-border bg-[#1a1b1f] px-5 py-2.5 text-sm font-semibold transition hover:bg-[#22252b]"
            >
              {dueNowMistakes > 0
                ? `Review due now (${dueNowMistakes})`
                : openMistakes > 0
                  ? `Review queue (${openMistakes})`
                  : "Review mistakes"}
            </Link>

            {hasInProgress ? (
              <form action={startDailyPractice} className="pointer-events-auto">
                <input type="hidden" name="forceNew" value="1" />
                <input type="hidden" name="mode" value="adaptive" />
                <button
                  type="submit"
                  className="rounded-xl border border-border bg-[#1a1b1f] px-5 py-2.5 text-sm font-semibold transition hover:bg-[#22252b]"
                >
                  Start fresh adaptive
                </button>
              </form>
            ) : (
              <form action={startAssessment} className="pointer-events-auto">
                <input type="hidden" name="forceNew" value="1" />
                <button
                  type="submit"
                  className="rounded-xl border border-border bg-[#1a1b1f] px-5 py-2.5 text-sm font-semibold transition hover:bg-[#22252b]"
                >
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
              <p className="mt-1 text-xs text-muted">
                Streak freeze: {streakFreezeReady ? "Ready" : `Cooldown (${freezeCooldownDays}d)`}
              </p>
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

          <div className="mt-4 rounded-xl border border-border bg-[#1b1c20] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Daily quest</p>
              <span
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  todayQuestProgress.completed
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                    : "border-border bg-[#202228] text-muted"
                }`}
              >
                {todayQuestProgress.completed ? "Complete" : "In progress"}
              </span>
            </div>
            <p className="mt-2 font-semibold">{todayQuest.title}</p>
            <p className="mt-1 text-sm text-muted">{todayQuest.description}</p>
            <p className="mt-2 text-xs text-muted">
              Progress: {todayQuestProgress.value}/{todayQuestProgress.target}
              {questRewardClaimed ? ` · reward claimed (+${todayQuest.bonusXp} XP)` : ` · reward ${todayQuest.bonusXp} XP`}
            </p>
          </div>
        </section>

        <section className="mb-7 rounded-2xl border border-border bg-[#16171a] p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-2xl font-semibold">Today&apos;s mission</h3>
            <span className="rounded-full border border-border bg-[#1f2126] px-3 py-1 text-xs text-muted">
              {missionDoneCount}/3 complete
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-[#1b1c20] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Mission 1</p>
              <p className="mt-2 font-semibold">Complete one daily session</p>
              <p className="mt-1 text-xs text-muted">
                {missionPracticeDone ? "Done today" : "Not completed yet"}
              </p>
              <span
                className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs ${
                  missionPracticeDone
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                    : "border-border bg-[#1f2126] text-muted"
                }`}
              >
                {missionPracticeDone ? "Complete" : "Open"}
              </span>
            </div>

            <div className="rounded-xl border border-border bg-[#1b1c20] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Mission 2</p>
              <p className="mt-2 font-semibold">Review mistakes queue</p>
              <p className="mt-1 text-xs text-muted">
                {missionReviewDone
                  ? openMistakes > 0
                    ? `No urgent items · ${openMistakes} in queue`
                    : "No open mistakes"
                  : `${dueNowMistakes} due now${nextDueLabel ? ` · next in ${nextDueLabel}` : ""}`}
              </p>
              <span
                className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs ${
                  missionReviewDone
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                    : "border-border bg-[#1f2126] text-muted"
                }`}
              >
                {missionReviewDone ? "Complete" : "Pending"}
              </span>
            </div>

            <div className="rounded-xl border border-border bg-[#1b1c20] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Mission 3</p>
              <p className="mt-2 font-semibold">Hit daily XP goal</p>
              <p className="mt-1 text-xs text-muted">
                {xpToday}/{dailyGoalTarget} XP
              </p>
              <span
                className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs ${
                  missionGoalDone
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                    : "border-border bg-[#1f2126] text-muted"
                }`}
              >
                {missionGoalDone ? "Complete" : "In progress"}
              </span>
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
                <>
                  <div className="flex flex-wrap gap-2">
                    {weakAreas.map((item) => (
                      <span key={item.category} className="rounded-full border border-border bg-[#1f2126] px-3 py-1 text-sm text-muted">
                        {item.category}
                      </span>
                    ))}
                  </div>
                  {weakSubtopics.length > 0 ? (
                    <p className="mt-3 text-sm text-muted">
                      Weak subtopics: {weakSubtopics.join(" · ")}
                    </p>
                  ) : null}
                  {dueNowMistakes > 0 ? (
                    <p className="mt-2 text-sm text-[#e4d2a4]">
                      {dueNowMistakes} review item(s) due now from your mistake queue.
                    </p>
                  ) : null}
                </>
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
                    <p className="mt-1 text-xs text-[#d5d8de]">
                      Level {item.level} · {item.xpIntoLevel}/{item.xpNeededForNextLevel} XP to next
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
              <p className="mt-3 text-3xl font-semibold">Level {overallLevelProgress.level}</p>
              <p className="mt-2 text-sm text-muted">
                {totalDisciplineXp} total XP · {overallLevelProgress.xpIntoLevel}/
                {overallLevelProgress.xpNeededForNextLevel} toward next level
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${Math.max(6, overallLevelProgress.progressPercent)}%` }}
                />
              </div>
            </section>
            <section className="rounded-2xl border border-border bg-[#16171a] p-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">Crew leaderboard (7d)</p>
                <span className="text-xs text-muted">{leaderboardEntries.length} active</span>
              </div>

              {leaderboardEntries.length > 0 ? (
                <div className="space-y-2">
                  {leaderboardEntries.map((entry, index) => (
                    <div key={entry.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-[#1b1c20] px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="w-5 text-xs text-muted">{index + 1}</span>
                        {entry.avatarUrl ? (
                          <img
                            src={entry.avatarUrl}
                            alt={entry.name}
                            className="h-7 w-7 rounded-full border border-border object-cover"
                          />
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-[#1f2126] text-xs font-semibold">
                            {entry.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {entry.name}
                            {entry.id === user.id ? (
                              <span className="ml-1 text-xs text-muted">(You)</span>
                            ) : null}
                          </p>
                          {entry.username ? (
                            <p className="truncate text-xs text-muted">@{entry.username}</p>
                          ) : null}
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-[#e4d2a4]">{entry.xp} XP</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">No crew XP data yet this week.</p>
              )}
            </section>
            {lastPracticeSession?.coach_summary ? (
              <section className="rounded-2xl border border-border bg-[#16171a] p-6">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">Coach insight</p>
                <p className="mt-3 text-sm text-[#d8dbdf]">{String(lastPracticeSession.coach_summary)}</p>
                {lastPracticeSession?.coach_next_focus ? (
                  <p className="mt-2 text-sm text-muted">Next focus: {String(lastPracticeSession.coach_next_focus)}</p>
                ) : null}
              </section>
            ) : null}
          </aside>
        </section>
      </Container>
    </main>
  );
}
