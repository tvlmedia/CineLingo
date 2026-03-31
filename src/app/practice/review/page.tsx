import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseQuestionOptions } from "@/lib/assessment/engine";
import { Container } from "@/components/ui";
import { ReviewMistakesClient } from "./ReviewMistakesClient";
import { computeNextReviewAtIso, dueInMs, formatDueWindowLabel, isReviewDueNow } from "@/lib/practice/review-schedule";

type MissedRowRaw = {
  id: unknown;
  miss_count: unknown;
  correct_review_count: unknown;
  last_missed_at: unknown;
  last_reviewed_at: unknown;
  question:
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
};

function normalizeQuestion(value: MissedRowRaw["question"]) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || typeof raw !== "object") return null;

  const id = typeof raw.id === "string" ? raw.id : null;
  const category = typeof raw.category === "string" ? raw.category : null;
  const prompt = typeof raw.prompt === "string" ? raw.prompt : null;
  const explanation = typeof raw.explanation === "string" ? raw.explanation : null;
  const parsedOptions = parseQuestionOptions(raw.options);

  if (!id || !category || !prompt || !explanation || !parsedOptions) {
    return null;
  }

  return {
    id,
    category,
    prompt,
    explanation,
    options: parsedOptions.map((option) => ({ id: option.id, text: option.text })),
  };
}

export default async function PracticeReviewPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("user_missed_questions")
    .select(
      "id, miss_count, correct_review_count, last_missed_at, last_reviewed_at, question:assessment_questions(id, category, prompt, options, explanation)"
    )
    .eq("user_id", user.id)
    .eq("status", "open")
    .limit(80);

  const now = new Date();
  const questions = ((data || []) as MissedRowRaw[])
    .map((row) => {
      const question = normalizeQuestion(row.question);
      if (!question) return null;

      const missedState = {
        missCount: Number(row.miss_count || 0),
        correctReviewCount: Number(row.correct_review_count || 0),
        lastMissedAt: typeof row.last_missed_at === "string" ? row.last_missed_at : null,
        lastReviewedAt: typeof row.last_reviewed_at === "string" ? row.last_reviewed_at : null,
      };
      const nextReviewAt = computeNextReviewAtIso(missedState, now);
      const nextDueInMs = dueInMs(missedState, now);
      const dueNow = isReviewDueNow(missedState, now);

      return {
        missedId: typeof row.id === "string" ? row.id : question.id,
        questionId: question.id,
        category: question.category,
        prompt: question.prompt,
        explanation: question.explanation,
        options: question.options,
        missCount: missedState.missCount,
        correctedCount: missedState.correctReviewCount,
        lastMissedAt: missedState.lastMissedAt,
        lastReviewedAt: missedState.lastReviewedAt,
        dueNow,
        nextReviewAt,
        dueLabel: formatDueWindowLabel(nextDueInMs),
        dueInMs: nextDueInMs,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => {
      if (a.dueNow !== b.dueNow) return a.dueNow ? -1 : 1;
      if (a.dueInMs !== b.dueInMs) return a.dueInMs - b.dueInMs;
      if (a.missCount !== b.missCount) return b.missCount - a.missCount;
      return String(a.lastMissedAt || "").localeCompare(String(b.lastMissedAt || ""));
    });

  const dueNowCount = questions.filter((row) => row.dueNow).length;

  return (
    <main className="min-h-screen py-8 md:py-10">
      <Container>
        <div className="mx-auto max-w-4xl space-y-6">
          <section className="rounded-2xl border border-border bg-[#16171a] p-6 md:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted">Review mistakes</p>
                <h1 className="mt-1 text-3xl font-semibold md:text-4xl">Weak-Area Recovery</h1>
              </div>
              <Link
                href="/dashboard"
                className="rounded-xl border border-border bg-[#1a1b1f] px-3 py-2 text-sm font-semibold transition hover:bg-[#22252b]"
              >
                Back to dashboard
              </Link>
            </div>

            <p className="mt-3 text-sm text-muted">
              Retry previously missed questions with immediate feedback and explanations.
            </p>
            <p className="mt-2 text-xs text-muted">
              {dueNowCount > 0
                ? `${dueNowCount} question(s) due right now`
                : "No urgent reviews due right now. You can still clear upcoming items."}
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-[#16171a] p-6 md:p-7">
            {questions.length === 0 ? (
              <div className="rounded-xl border border-border bg-[#1b1c20] p-4">
                <p className="text-sm text-muted">No open mistakes right now. Great consistency.</p>
              </div>
            ) : (
              <ReviewMistakesClient questions={questions} />
            )}
          </section>
        </div>
      </Container>
    </main>
  );
}
