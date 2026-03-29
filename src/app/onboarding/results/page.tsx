import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Container } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AssessmentBand, AssessmentCategory } from "@/lib/assessment/types";
import { scoreBand, totalInterpretation } from "@/lib/assessment/engine";
import { retakeAssessment } from "../actions";

type ResultsSearchParams = {
  attempt?: string;
};

type ScoreRow = {
  category: AssessmentCategory;
  correct_count: number;
  question_count: number;
  score_band: AssessmentBand;
  interpretation: string | null;
};

function bandClass(band: AssessmentBand): string {
  if (band === "Strong") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  if (band === "Solid") return "border-cyan-500/40 bg-cyan-500/10 text-cyan-200";
  if (band === "Developing") return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  return "border-red-500/40 bg-red-500/10 text-red-200";
}

export default async function OnboardingResultsPage({
  searchParams,
}: {
  searchParams?: Promise<ResultsSearchParams>;
}) {
  const user = await requireUser();
  const supabase = await createClient();
  const params = (await searchParams) || {};

  const attemptId = String(params.attempt || "").trim();
  if (!attemptId) {
    redirect("/onboarding?error=attempt_not_found");
  }

  const { data: attempt } = await supabase
    .from("assessment_attempts")
    .select("id, total_correct, total_questions, status, completed_at")
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!attempt || attempt.status !== "completed") {
    redirect("/onboarding?error=result_load_failed");
  }

  const { data: scores } = await supabase
    .from("user_assessment_scores")
    .select("category, correct_count, question_count, score_band, interpretation")
    .eq("attempt_id", attemptId)
    .eq("user_id", user.id)
    .order("category", { ascending: true });

  const scoreRows = (scores || []) as ScoreRow[];
  const overallBand = scoreBand(attempt.total_correct || 0, attempt.total_questions || 0);
  const overallInterpretation = totalInterpretation(
    attempt.total_correct || 0,
    attempt.total_questions || 0
  );

  return (
    <main className="min-h-screen py-10 md:py-14">
      <Container>
        <div className="mx-auto max-w-4xl space-y-6">
          <Card>
            <p className="mb-3 text-xs uppercase tracking-[0.22em] text-muted">Assessment Results</p>
            <h1 className="mb-2 text-3xl font-bold md:text-4xl">Your Current Baseline</h1>
            <p className="text-muted">Completed on {new Date(String(attempt.completed_at)).toLocaleString()}.</p>

            <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-sm uppercase tracking-[0.14em] text-muted">Overall score</p>
                <p className="text-4xl font-bold">
                  {attempt.total_correct}/{attempt.total_questions}
                </p>
                <p className="mt-1 text-sm text-muted">{overallInterpretation}</p>
              </div>
              <span className={`rounded-2xl border px-4 py-2 text-sm font-semibold ${bandClass(overallBand)}`}>
                {overallBand}
              </span>
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-2xl font-semibold">Category Breakdown</h2>
            <div className="space-y-3">
              {scoreRows.length === 0 ? (
                <p className="text-sm text-muted">No category score rows found for this attempt.</p>
              ) : (
                scoreRows.map((row) => (
                  <div
                    key={row.category}
                    className="rounded-2xl border border-border bg-white/5 p-4 md:flex md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-semibold">{row.category}</p>
                      <p className="text-sm text-muted">
                        {row.correct_count}/{row.question_count} correct
                      </p>
                      {row.interpretation ? (
                        <p className="mt-1 text-sm text-muted">{row.interpretation}</p>
                      ) : null}
                    </div>
                    <span
                      className={`mt-3 inline-block rounded-xl border px-3 py-1 text-xs font-semibold md:mt-0 ${bandClass(
                        row.score_band
                      )}`}
                    >
                      {row.score_band}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <form action={retakeAssessment}>
                <button className="rounded-2xl bg-accent px-4 py-2.5 font-semibold text-[#04231d]">
                  Retake assessment
                </button>
              </form>
              <Link
                href="/dashboard"
                className="rounded-2xl border border-border bg-white/5 px-4 py-2.5 font-semibold transition hover:bg-white/10"
              >
                Back to dashboard
              </Link>
            </div>
          </Card>
        </div>
      </Container>
    </main>
  );
}
