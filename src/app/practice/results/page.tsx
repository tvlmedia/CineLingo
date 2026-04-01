import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseQuestionOptions } from "@/lib/assessment/engine";
import { ASSESSMENT_CATEGORIES, type AssessmentCategory } from "@/lib/assessment/types";
import { Container } from "@/components/ui";
import { startDailyPractice } from "@/app/practice/actions";
import { reportPracticeQuestion } from "./actions";

type JoinedQuestionRaw =
  | {
      id?: unknown;
      category?: unknown;
      prompt?: unknown;
      options?: unknown;
      explanation?: unknown;
    }
  | Array<{
      id?: unknown;
      category?: unknown;
      prompt?: unknown;
      options?: unknown;
      explanation?: unknown;
    }>
  | null;

function isAssessmentCategory(value: string): value is AssessmentCategory {
  return (ASSESSMENT_CATEGORIES as readonly string[]).includes(value);
}

function normalizeJoinedQuestion(value: JoinedQuestionRaw): {
  id: string;
  category: string;
  prompt: string;
  options: unknown;
  explanation: string;
} | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || typeof raw !== "object") return null;

  const id = typeof raw.id === "string" ? raw.id : "";
  const category = typeof raw.category === "string" ? raw.category : "";
  const prompt = typeof raw.prompt === "string" ? raw.prompt : "";
  const explanation = typeof raw.explanation === "string" ? raw.explanation : "";

  if (!id || !category || !prompt || !explanation) return null;
  return { id, category, prompt, options: raw.options, explanation };
}

function weakestCategories(rows: Array<{ category: string; total: number; correct: number }>): string[] {
  return rows
    .filter((row) => row.total > 0)
    .map((row) => ({
      category: row.category,
      ratio: row.correct / row.total,
    }))
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 3)
    .map((row) => row.category);
}

function strongestCategory(rows: Array<{ category: string; total: number; correct: number }>): string | null {
  const sorted = rows
    .filter((row) => row.total > 0)
    .map((row) => ({ category: row.category, ratio: row.correct / row.total }))
    .sort((a, b) => b.ratio - a.ratio);

  return sorted.length > 0 ? sorted[0].category : null;
}

function readLessonPlanMeta(value: unknown): {
  dailyQuestTitle: string;
  dailyQuestRewardGranted: boolean;
  dailyQuestBonusXp: number;
  streakFreezeApplied: boolean;
  disciplineLevelUps: Array<{
    category: AssessmentCategory;
    fromLevel: number;
    toLevel: number;
  }>;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      dailyQuestTitle: "",
      dailyQuestRewardGranted: false,
      dailyQuestBonusXp: 0,
      streakFreezeApplied: false,
      disciplineLevelUps: [],
    };
  }

  const row = value as Record<string, unknown>;
  const rawLevelUps = Array.isArray(row.disciplineLevelUps) ? row.disciplineLevelUps : [];
  const disciplineLevelUps = rawLevelUps
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const r = entry as Record<string, unknown>;
      const categoryRaw = typeof r.category === "string" ? r.category : "";
      if (!isAssessmentCategory(categoryRaw)) return null;

      const fromLevel = Number(r.fromLevel || 0);
      const toLevel = Number(r.toLevel || 0);
      if (!Number.isFinite(fromLevel) || !Number.isFinite(toLevel) || toLevel <= fromLevel) return null;

      return {
        category: categoryRaw,
        fromLevel,
        toLevel,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  return {
    dailyQuestTitle: typeof row.dailyQuestTitle === "string" ? row.dailyQuestTitle : "",
    dailyQuestRewardGranted: Boolean(row.dailyQuestRewardGranted),
    dailyQuestBonusXp: Number(row.dailyQuestBonusXp || 0),
    streakFreezeApplied: Boolean(row.streakFreezeApplied),
    disciplineLevelUps,
  };
}

export default async function PracticeResultsPage({
  searchParams,
}: {
  searchParams?: Promise<{ session?: string; reported?: string; error?: string }>;
}) {
  const user = await requireUser();
  const supabase = await createClient();
  const params = (await searchParams) || {};

  const sessionId = String(params.session || "").trim();
  const reported = String(params.reported || "") === "1";
  const reportError = String(params.error || "") === "report_failed";
  if (!sessionId) {
    redirect("/dashboard");
  }

  const { data: session } = await supabase
    .from("practice_sessions")
    .select(
      "id, status, source, total_questions, correct_count, xp_earned, completed_at, coach_summary, coach_next_focus, strongest_discipline, weakest_discipline, lesson_plan"
    )
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!session) {
    redirect("/dashboard");
  }

  if (session.status !== "completed") {
    redirect(`/practice?session=${encodeURIComponent(sessionId)}&q=1`);
  }

  const lessonMeta = readLessonPlanMeta(session.lesson_plan);

  const { data: answers } = await supabase
    .from("practice_answers")
    .select(
      "id, question_order, selected_option_id, is_correct, question:assessment_questions(id, category, prompt, options, explanation)"
    )
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .order("question_order", { ascending: true });

  const reviewRows = (answers || [])
    .map((row) => {
      const question = normalizeJoinedQuestion((row as { question?: JoinedQuestionRaw } | null)?.question ?? null);
      if (!question) return null;

      const questionId = question.id;
      const category = question.category;
      if (!isAssessmentCategory(category)) return null;

      const prompt = question.prompt;
      const explanation = question.explanation;
      const options = parseQuestionOptions(question.options);

      if (!prompt || !explanation || !options) return null;

      const selectedId = typeof row.selected_option_id === "string" ? row.selected_option_id : null;
      const selected = options.find((option) => option.id === selectedId);
      const correct = options.find((option) => option.isCorrect);

      return {
        questionId,
        questionOrder: Number(row.question_order || 0),
        category,
        prompt,
        explanation,
        isCorrect: Boolean(row.is_correct),
        selectedText: selected?.text || "No answer",
        correctText: correct?.text || "",
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const perCategoryMap = new Map<AssessmentCategory, { total: number; correct: number }>();
  for (const category of ASSESSMENT_CATEGORIES) {
    perCategoryMap.set(category, { total: 0, correct: 0 });
  }

  reviewRows.forEach((row) => {
    const bucket = perCategoryMap.get(row.category as AssessmentCategory);
    if (!bucket) return;
    bucket.total += 1;
    if (row.isCorrect) bucket.correct += 1;
  });

  const perCategory = ASSESSMENT_CATEGORIES.map((category) => ({
    category,
    total: perCategoryMap.get(category)?.total || 0,
    correct: perCategoryMap.get(category)?.correct || 0,
  }));

  const weak = weakestCategories(perCategory);
  const strongestToday = String(session.strongest_discipline || "") || strongestCategory(perCategory);
  const weakestToday = String(session.weakest_discipline || "") || (weak[0] || "");
  const missed = reviewRows.filter((row) => !row.isCorrect);

  const completedDate = session.completed_at ? String(session.completed_at).slice(0, 10) : null;
  const { data: dailyRow } = completedDate
    ? await supabase
        .from("user_daily_progress")
        .select("current_streak, xp_earned, goal_target_xp, goal_met")
        .eq("user_id", user.id)
        .eq("day_date", completedDate)
        .maybeSingle()
    : { data: null };

  return (
    <main className="min-h-screen py-8 md:py-10">
      <Container>
        <div className="mx-auto max-w-4xl space-y-6">
          {reported ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              Thanks. We flagged this question for quality review.
            </div>
          ) : null}
          {reportError ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              Could not submit your report. Try again.
            </div>
          ) : null}
          <section className="rounded-2xl border border-border bg-[#16171a] p-6 md:p-7">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Practice summary</p>
            <h1 className="mt-1 text-3xl font-semibold md:text-4xl">Daily Session Complete</h1>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-[#1b1c20] px-4 py-3">
                <p className="text-xs text-muted">Score</p>
                <p className="mt-1 text-xl font-semibold">
                  {session.correct_count}/{session.total_questions}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-[#1b1c20] px-4 py-3">
                <p className="text-xs text-muted">XP earned</p>
                <p className="mt-1 text-xl font-semibold">+{session.xp_earned}</p>
              </div>
              <div className="rounded-xl border border-border bg-[#1b1c20] px-4 py-3">
                <p className="text-xs text-muted">Current streak</p>
                <p className="mt-1 text-xl font-semibold">{Number(dailyRow?.current_streak || 0)} days</p>
              </div>
            </div>

            <p className="mt-4 text-sm text-muted">
              Daily goal: {Number(dailyRow?.xp_earned || 0)}/{Number(dailyRow?.goal_target_xp || 50)} XP
              {dailyRow?.goal_met ? " (goal met)" : ""}
            </p>
            <p className="mt-1 text-sm text-muted">
              Session type:{" "}
              {String(session.source || "") === "daily_ai"
                ? "AI coach session"
                : String(session.source || "") === "daily_ai_hybrid"
                  ? "AI + question bank session"
                  : String(session.source || "") === "daily_recovery"
                    ? "Recovery sprint session"
                  : "Adaptive bank session"}
            </p>
            {lessonMeta.dailyQuestRewardGranted ? (
              <p className="mt-1 text-sm text-[#e4d2a4]">
                Daily quest complete{lessonMeta.dailyQuestTitle ? `: ${lessonMeta.dailyQuestTitle}` : ""} · +{lessonMeta.dailyQuestBonusXp} XP bonus
              </p>
            ) : null}
            {lessonMeta.streakFreezeApplied ? (
              <p className="mt-1 text-sm text-[#f1debc]">
                Streak freeze applied: your streak was protected for one missed day.
              </p>
            ) : null}
            {lessonMeta.disciplineLevelUps.length > 0 ? (
              <div className="mt-2 rounded-xl border border-border bg-[#1b1c20] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Discipline level up</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {lessonMeta.disciplineLevelUps.map((entry) => (
                    <span
                      key={`${entry.category}-${entry.fromLevel}-${entry.toLevel}`}
                      className="rounded-full border border-border bg-[#1f2126] px-3 py-1 text-xs text-[#f1debc]"
                    >
                      {entry.category}: Lv {entry.fromLevel} → Lv {entry.toLevel}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {strongestToday ? (
              <p className="mt-2 text-sm text-muted">Strongest area today: {strongestToday}</p>
            ) : null}
            {weakestToday ? (
              <p className="mt-1 text-sm text-muted">Weakest area today: {weakestToday}</p>
            ) : null}
            {session.coach_summary ? (
              <div className="mt-4 rounded-xl border border-border bg-[#1b1c20] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Coach summary</p>
                <p className="mt-2 text-sm text-[#d8dbdf]">{String(session.coach_summary)}</p>
                {session.coach_next_focus ? (
                  <p className="mt-2 text-sm text-muted">Next focus: {String(session.coach_next_focus)}</p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <form action={startDailyPractice}>
                <input type="hidden" name="forceNew" value="1" />
                <input type="hidden" name="mode" value="adaptive" />
                <button className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-[#13100a]">
                  Start next daily session
                </button>
              </form>
              <Link
                href="/practice/review"
                className="rounded-xl border border-border bg-[#1a1b1f] px-5 py-2.5 text-sm font-semibold transition hover:bg-[#22252b]"
              >
                Review mistakes
              </Link>
              <Link
                href="/dashboard"
                className="rounded-xl border border-border bg-[#1a1b1f] px-5 py-2.5 text-sm font-semibold transition hover:bg-[#22252b]"
              >
                Back to dashboard
              </Link>
            </div>

            <details className="mt-3 rounded-xl border border-border bg-[#1b1c20] px-4 py-3">
              <summary className="cursor-pointer list-none text-xs uppercase tracking-[0.16em] text-muted">
                More session types
              </summary>
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={startDailyPractice}>
                  <input type="hidden" name="forceNew" value="1" />
                  <input type="hidden" name="mode" value="recovery" />
                  <button className="rounded-lg border border-border bg-[#1a1b1f] px-3 py-2 text-sm font-semibold transition hover:bg-[#22252b]">
                    Start recovery sprint
                  </button>
                </form>
                <form action={startDailyPractice}>
                  <input type="hidden" name="forceNew" value="1" />
                  <input type="hidden" name="mode" value="ai_only" />
                  <input type="hidden" name="strictAi" value="1" />
                  <button className="rounded-lg border border-border bg-[#1a1b1f] px-3 py-2 text-sm font-semibold transition hover:bg-[#22252b]">
                    Start AI coach session
                  </button>
                </form>
                <form action={startDailyPractice}>
                  <input type="hidden" name="forceNew" value="1" />
                  <input type="hidden" name="mode" value="bank_only" />
                  <button className="rounded-lg border border-border bg-[#1a1b1f] px-3 py-2 text-sm font-semibold transition hover:bg-[#22252b]">
                    Start fast session
                  </button>
                </form>
              </div>
            </details>
          </section>

          <section className="rounded-2xl border border-border bg-[#16171a] p-6 md:p-7">
            <h2 className="text-2xl font-semibold">Weak areas to review</h2>
            {weak.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {weak.map((category) => (
                  <span key={category} className="rounded-full border border-border bg-[#1f2126] px-3 py-1 text-sm text-muted">
                    {category}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">No weak area signal yet.</p>
            )}
          </section>

          <section id="missed-review" className="rounded-2xl border border-border bg-[#16171a] p-6 md:p-7">
            <h2 className="text-2xl font-semibold">Missed questions review</h2>
            {missed.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Perfect session. No missed questions.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {missed.map((item) => (
                  <details
                    key={`${item.questionOrder}-${item.prompt}`}
                    className="rounded-xl border border-border bg-[#1b1c20] p-4"
                    open={item.questionOrder === missed[0]?.questionOrder}
                  >
                    <summary className="cursor-pointer list-none">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted">{item.category}</p>
                      <h3 className="mt-1 text-base font-semibold md:text-lg">{item.prompt}</h3>
                      <p className="mt-2 text-sm text-[#e4e6eb]">
                        Your answer: <span className="font-semibold">{item.selectedText}</span>
                      </p>
                    </summary>
                    <div className="mt-3">
                      <p className="text-sm text-[#f1debc]">
                        Correct answer: <span className="font-semibold">{item.correctText}</span>
                      </p>
                      <p className="mt-2 text-sm text-muted">{item.explanation}</p>
                      <form action={reportPracticeQuestion} className="mt-3">
                        <input type="hidden" name="sessionId" value={sessionId} />
                        <input type="hidden" name="questionId" value={item.questionId} />
                        <input type="hidden" name="questionOrder" value={item.questionOrder} />
                        <input
                          type="hidden"
                          name="details"
                          value={`Prompt: ${item.prompt}\nYour answer: ${item.selectedText}\nMarked correct: ${item.correctText}`}
                        />
                        <button
                          type="submit"
                          className="rounded-lg border border-border bg-[#1a1b1f] px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-[#22252b]"
                        >
                          Mark as ambiguous
                        </button>
                      </form>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>
        </div>
      </Container>
    </main>
  );
}
