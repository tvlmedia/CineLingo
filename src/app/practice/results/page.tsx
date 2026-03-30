import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseQuestionOptions } from "@/lib/assessment/engine";
import { ASSESSMENT_CATEGORIES, type AssessmentCategory } from "@/lib/assessment/types";
import { Container } from "@/components/ui";
import { startDailyPractice } from "@/app/practice/actions";

function isAssessmentCategory(value: string): value is AssessmentCategory {
  return (ASSESSMENT_CATEGORIES as readonly string[]).includes(value);
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

export default async function PracticeResultsPage({
  searchParams,
}: {
  searchParams?: Promise<{ session?: string }>;
}) {
  const user = await requireUser();
  const supabase = await createClient();
  const params = (await searchParams) || {};

  const sessionId = String(params.session || "").trim();
  if (!sessionId) {
    redirect("/dashboard");
  }

  const { data: session } = await supabase
    .from("practice_sessions")
    .select("id, status, total_questions, correct_count, xp_earned, completed_at, coach_summary, coach_next_focus, strongest_discipline, weakest_discipline")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!session) {
    redirect("/dashboard");
  }

  if (session.status !== "completed") {
    redirect(`/practice?session=${encodeURIComponent(sessionId)}&q=1`);
  }

  const { data: answers } = await supabase
    .from("practice_answers")
    .select(
      "id, question_order, selected_option_id, is_correct, question:assessment_questions(category, prompt, options, explanation)"
    )
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .order("question_order", { ascending: true });

  const reviewRows = (answers || [])
    .map((row) => {
      const question = row.question as
        | {
            category?: unknown;
            prompt?: unknown;
            options?: unknown;
            explanation?: unknown;
          }
        | null;

      const category = String(question?.category || "");
      if (!isAssessmentCategory(category)) return null;

      const prompt = String(question?.prompt || "");
      const explanation = String(question?.explanation || "");
      const options = parseQuestionOptions(question?.options);

      if (!prompt || !explanation || !options) return null;

      const selectedId = typeof row.selected_option_id === "string" ? row.selected_option_id : null;
      const selected = options.find((option) => option.id === selectedId);
      const correct = options.find((option) => option.isCorrect);

      return {
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
                <button className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-[#13100a]">
                  Start another session
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

          <section className="rounded-2xl border border-border bg-[#16171a] p-6 md:p-7">
            <h2 className="text-2xl font-semibold">Missed questions review</h2>
            {missed.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Perfect session. No missed questions.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {missed.map((item) => (
                  <div key={`${item.questionOrder}-${item.prompt}`} className="rounded-xl border border-border bg-[#1b1c20] p-4">
                    <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted">{item.category}</p>
                    <h3 className="text-lg font-semibold">{item.prompt}</h3>
                    <p className="mt-2 text-sm text-[#e4e6eb]">
                      Your answer: <span className="font-semibold">{item.selectedText}</span>
                    </p>
                    <p className="mt-1 text-sm text-[#f1debc]">
                      Correct answer: <span className="font-semibold">{item.correctText}</span>
                    </p>
                    <p className="mt-2 text-sm text-muted">{item.explanation}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </Container>
    </main>
  );
}
