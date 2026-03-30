import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Container } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AssessmentOption } from "@/lib/assessment/types";
import { parseQuestionOptions } from "@/lib/assessment/engine";
import { AssessmentRunner } from "./AssessmentRunner";

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

type RawAssessmentAnswerRow = {
  id: unknown;
  question_order: unknown;
  selected_option_id: unknown;
  options_order: unknown;
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

function normalizeQuestion(
  value: RawAssessmentAnswerRow["question"]
): AssessmentQuestionView["question"] {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const id = typeof candidate.id === "string" ? candidate.id : null;
  const category = typeof candidate.category === "string" ? candidate.category : null;
  const prompt = typeof candidate.prompt === "string" ? candidate.prompt : null;
  const explanation = typeof candidate.explanation === "string" ? candidate.explanation : null;

  if (!id || !category || !prompt || !explanation) {
    return null;
  }

  return {
    id,
    category,
    prompt,
    options: candidate.options,
    explanation,
  };
}

function normalizeAnswerRows(value: unknown): AssessmentQuestionView[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((row): AssessmentQuestionView | null => {
      const raw = row as RawAssessmentAnswerRow;
      if (typeof raw.id !== "string" || typeof raw.question_order !== "number") {
        return null;
      }

      return {
        id: raw.id,
        question_order: raw.question_order,
        selected_option_id: typeof raw.selected_option_id === "string" ? raw.selected_option_id : null,
        options_order: raw.options_order,
        question: normalizeQuestion(raw.question),
      };
    })
    .filter((row): row is AssessmentQuestionView => Boolean(row));
}

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

  const rows = normalizeAnswerRows(answerRows);
  if (rows.length === 0) {
    redirect("/onboarding?error=attempt_not_found");
  }

  const errorMessage = assessmentErrorMessage(params.error);
  const requestedOrder = Number(params.q || 1);
  const initialQuestionOrder = Number.isFinite(requestedOrder)
    ? Math.max(1, Math.min(requestedOrder, rows.length))
    : 1;

  const runnerQuestions = rows
    .map((row) => {
      if (!row.question) return null;
      const parsedOptions = parseQuestionOptions(row.question.options);
      if (!parsedOptions) return null;

      return {
        answerId: row.id,
        questionOrder: row.question_order,
        selectedOptionId: row.selected_option_id,
        category: row.question.category,
        prompt: row.question.prompt,
        options: orderedOptions(parsedOptions, row.options_order).map((option) => ({
          id: option.id,
          text: option.text,
        })),
      };
    })
    .filter(
      (row): row is {
        answerId: string;
        questionOrder: number;
        selectedOptionId: string | null;
        category: string;
        prompt: string;
        options: Array<{ id: string; text: string }>;
      } => Boolean(row)
    );

  if (runnerQuestions.length === 0) {
    redirect("/onboarding?error=result_load_failed");
  }

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

            {errorMessage ? (
              <p className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </p>
            ) : null}

            <AssessmentRunner
              attemptId={attemptId}
              questions={runnerQuestions}
              initialQuestionOrder={initialQuestionOrder}
            />
          </Card>
        </div>
      </Container>
    </main>
  );
}
