import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Container } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AssessmentOption } from "@/lib/assessment/types";
import { parseQuestionOptions, TOTAL_ASSESSMENT_QUESTIONS } from "@/lib/assessment/engine";
import { finalizeAssessment, submitAssessmentAnswer } from "../actions";

type AssessmentSearchParams = {
  attempt?: string;
  q?: string;
  error?: string;
};

type AssessmentQuestionView = {
  id: string;
  question_order: number;
  selected_option_id: string | null;
  options_order: unknown;
  question: {
    id: string;
    category: string;
    prompt: string;
    options: unknown;
    explanation: string;
  } | null;
};

function orderedOptions(options: AssessmentOption[], orderRaw: unknown): AssessmentOption[] {
  if (!Array.isArray(orderRaw)) {
    return options;
  }

  const orderIds = orderRaw.filter((value): value is string => typeof value === "string");
  if (orderIds.length !== options.length) {
    return options;
  }

  const map = new Map(options.map((option) => [option.id, option]));
  const ordered = orderIds.map((id) => map.get(id)).filter((entry): entry is AssessmentOption => Boolean(entry));
  if (ordered.length !== options.length) {
    return options;
  }

  return ordered;
}

function assessmentErrorMessage(errorCode: string | undefined): string | null {
  if (errorCode === "missing_answer") return "Choose one answer before continuing.";
  if (errorCode === "invalid_option") return "Invalid answer choice. Try again.";
  if (errorCode === "save_failed") return "Could not save your answer. Try again.";
  if (errorCode === "answer_not_found") return "Question not found for this attempt.";
  if (errorCode === "question_data_invalid") return "Question data is invalid. Contact support.";
  if (!errorCode) return null;
  return "Could not continue assessment.";
}

export default async function AssessmentPage({
  searchParams,
}: {
  searchParams?: Promise<AssessmentSearchParams>;
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
    .select("id, status, total_questions")
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!attempt) {
    redirect("/onboarding?error=attempt_not_found");
  }

  if (attempt.status === "completed") {
    redirect(`/onboarding/results?attempt=${encodeURIComponent(attemptId)}`);
  }

  const { data: answerRows } = await supabase
    .from("assessment_answers")
    .select(
      "id, question_order, selected_option_id, options_order, question:assessment_questions(id, category, prompt, options, explanation)"
    )
    .eq("attempt_id", attemptId)
    .eq("user_id", user.id)
    .order("question_order", { ascending: true });

  const rows = (answerRows || []) as AssessmentQuestionView[];
  if (rows.length === 0) {
    redirect("/onboarding?error=attempt_not_found");
  }

  const unansweredIndex = rows.findIndex((row) => !row.selected_option_id);
  const unresolvedQuestionOrder = unansweredIndex >= 0 ? rows[unansweredIndex].question_order : rows.length;

  const requestedOrder = Number(params.q || unresolvedQuestionOrder || 1);
  const safeOrder = Number.isFinite(requestedOrder)
    ? Math.max(1, Math.min(requestedOrder, rows.length))
    : unresolvedQuestionOrder;

  const currentRow = rows.find((row) => row.question_order === safeOrder) || rows[0];
  const currentQuestion = currentRow.question;

  if (!currentQuestion) {
    redirect("/onboarding?error=result_load_failed");
  }

  const parsedOptions = parseQuestionOptions(currentQuestion.options);
  if (!parsedOptions) {
    redirect("/onboarding?error=result_load_failed");
  }

  const visualOptions = orderedOptions(parsedOptions, currentRow.options_order);
  const answeredCount = rows.filter((row) => row.selected_option_id).length;
  const progress = Math.round((answeredCount / rows.length) * 100);
  const errorMessage = assessmentErrorMessage(params.error);

  return (
    <main className="min-h-screen py-10 md:py-14">
      <Container>
        <div className="mx-auto max-w-3xl space-y-6">
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-muted">Onboarding Intake</p>
                <h1 className="text-2xl font-bold md:text-3xl">Knowledge Assessment</h1>
              </div>
              <Link
                href="/onboarding"
                className="rounded-xl border border-border px-3 py-2 text-sm text-muted transition hover:bg-white/5"
              >
                Exit test
              </Link>
            </div>

            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between text-xs text-muted">
                <span>
                  Question {currentRow.question_order} of {rows.length}
                </span>
                <span>{progress}% complete</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
            </div>

            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted">{currentQuestion.category}</p>
            <h2 className="mb-5 text-xl font-semibold md:text-2xl">{currentQuestion.prompt}</h2>

            {errorMessage ? (
              <p className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </p>
            ) : null}

            <form action={submitAssessmentAnswer} className="space-y-4">
              <input type="hidden" name="attemptId" value={attemptId} />
              <input type="hidden" name="answerId" value={currentRow.id} />

              <div className="space-y-3">
                {visualOptions.map((option) => {
                  const optionId = `${currentRow.id}-${option.id}`;
                  return (
                    <label
                      key={option.id}
                      htmlFor={optionId}
                      className="block cursor-pointer rounded-2xl border border-border bg-white/5 p-4 transition hover:border-accent/70 hover:bg-white/10"
                    >
                      <div className="flex items-start gap-3">
                        <input
                          id={optionId}
                          type="radio"
                          name="selectedOptionId"
                          value={option.id}
                          required
                          defaultChecked={currentRow.selected_option_id === option.id}
                          className="mt-0.5 h-4 w-4"
                        />
                        <span>{option.text}</span>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <p className="text-xs text-muted">
                  {TOTAL_ASSESSMENT_QUESTIONS} total questions, fixed category balance.
                </p>
                <button className="rounded-2xl bg-accent px-5 py-2.5 font-semibold text-[#04231d]">
                  {currentRow.question_order === rows.length ? "Finish assessment" : "Save and continue"}
                </button>
              </div>
            </form>

            {answeredCount === rows.length ? (
              <form action={finalizeAssessment} className="mt-4">
                <input type="hidden" name="attemptId" value={attemptId} />
                <button className="text-sm font-semibold text-accent">Finalize now</button>
              </form>
            ) : null}
          </Card>
        </div>
      </Container>
    </main>
  );
}
