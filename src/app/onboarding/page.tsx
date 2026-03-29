import Link from "next/link";
import { Card, Container } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ASSESSMENT_CATEGORIES } from "@/lib/assessment/types";
import { QUESTIONS_PER_CATEGORY, TOTAL_ASSESSMENT_QUESTIONS } from "@/lib/assessment/engine";
import { createClient } from "@/lib/supabase/server";
import { startAssessment } from "./actions";

type OnboardingParams = {
  error?: string;
  debug?: string;
};

function onboardingErrorMessage(errorCode: string | undefined): string | null {
  if (errorCode === "question_setup_incomplete") {
    return "Question bank is not ready yet. Ask admin to seed all categories.";
  }
  if (errorCode === "start_failed") {
    return "Could not start assessment. Try again.";
  }
  if (errorCode === "attempt_not_found") {
    return "Assessment attempt not found.";
  }
  if (errorCode === "result_load_failed") {
    return "Could not compute results safely.";
  }
  if (!errorCode) {
    return null;
  }
  return "Could not continue onboarding assessment.";
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<OnboardingParams>;
}) {
  const user = await requireUser();
  const supabase = await createClient();
  const params = (await searchParams) || {};

  const [inProgressResult, latestCompletedResult] = await Promise.all([
    supabase
      .from("assessment_attempts")
      .select("id, started_at, total_questions")
      .eq("user_id", user.id)
      .eq("status", "in_progress")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("assessment_attempts")
      .select("id, total_correct, total_questions, completed_at")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const inProgressAttempt = inProgressResult.data;
  const latestCompleted = latestCompletedResult.data;
  const errorMessage = onboardingErrorMessage(params.error);
  const debugMessage = params.debug ? safeDecode(String(params.debug)) : null;

  return (
    <main className="min-h-screen py-10 md:py-14">
      <Container>
        <div className="mx-auto max-w-4xl space-y-6">
          <Card>
            <p className="mb-3 text-xs uppercase tracking-[0.22em] text-muted">Onboarding Assessment</p>
            <h1 className="mb-4 text-3xl font-bold md:text-4xl">Cinematic Knowledge Intake</h1>
            <p className="mb-6 max-w-3xl text-muted">
              This intake estimates your current level across six cinematography disciplines. You will
              answer {TOTAL_ASSESSMENT_QUESTIONS} questions ({QUESTIONS_PER_CATEGORY} per category), one at a
              time.
            </p>

            <div className="mb-6 flex flex-wrap gap-2">
              {ASSESSMENT_CATEGORIES.map((category) => (
                <span
                  key={category}
                  className="rounded-xl border border-border bg-white/5 px-3 py-1.5 text-xs text-muted"
                >
                  {category}
                </span>
              ))}
            </div>

            {errorMessage ? (
              <p className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </p>
            ) : null}
            {debugMessage ? (
              <p className="mb-5 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-xs text-yellow-100">
                Debug: {debugMessage}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              {inProgressAttempt ? (
                <Link
                  href={`/onboarding/assessment?attempt=${encodeURIComponent(String(inProgressAttempt.id))}&q=1`}
                  className="rounded-2xl border border-accent bg-accent px-4 py-2.5 font-semibold text-[#04231d]"
                >
                  Continue current attempt
                </Link>
              ) : null}

              <form action={startAssessment}>
                <button className="rounded-2xl border border-border bg-white/5 px-4 py-2.5 font-semibold transition hover:bg-white/10">
                  {inProgressAttempt ? "Start fresh attempt" : "Start assessment"}
                </button>
                {inProgressAttempt ? <input type="hidden" name="forceNew" value="1" /> : null}
              </form>

              <Link
                href="/dashboard"
                className="rounded-2xl border border-border bg-white/5 px-4 py-2.5 font-semibold transition hover:bg-white/10"
              >
                Back to dashboard
              </Link>
            </div>
          </Card>

          {latestCompleted ? (
            <Card>
              <p className="mb-2 text-xs uppercase tracking-[0.22em] text-muted">Latest Result</p>
              <p className="text-lg font-semibold">
                {latestCompleted.total_correct}/{latestCompleted.total_questions} correct
              </p>
              <p className="mt-1 text-sm text-muted">
                Completed {new Date(String(latestCompleted.completed_at)).toLocaleString()}.
              </p>
              <div className="mt-4">
                <Link
                  href={`/onboarding/results?attempt=${encodeURIComponent(String(latestCompleted.id))}`}
                  className="font-semibold text-accent"
                >
                  Open result breakdown
                </Link>
              </div>
            </Card>
          ) : null}
        </div>
      </Container>
    </main>
  );
}
