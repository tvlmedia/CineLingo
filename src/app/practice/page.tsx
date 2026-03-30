import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseQuestionOptions } from "@/lib/assessment/engine";
import { Container } from "@/components/ui";
import { PracticeRunner } from "./PracticeRunner";

type PracticeSearchParams = {
  session?: string;
  q?: string;
  error?: string;
};

type PracticeAnswerRowRaw = {
  id: unknown;
  question_order: unknown;
  selected_option_id: unknown;
  is_correct: unknown;
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
  value: PracticeAnswerRowRaw["question"]
): {
  id: string;
  category: string;
  prompt: string;
  options: unknown;
  explanation: string;
} | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || typeof candidate !== "object") return null;

  const id = typeof candidate.id === "string" ? candidate.id : null;
  const category = typeof candidate.category === "string" ? candidate.category : null;
  const prompt = typeof candidate.prompt === "string" ? candidate.prompt : null;
  const explanation = typeof candidate.explanation === "string" ? candidate.explanation : null;

  if (!id || !category || !prompt || !explanation) return null;

  return {
    id,
    category,
    prompt,
    options: candidate.options,
    explanation,
  };
}

function normalizeRows(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((row): {
      id: string;
      question_order: number;
      selected_option_id: string | null;
      is_correct: boolean | null;
      options_order: unknown;
      question: { id: string; category: string; prompt: string; options: unknown; explanation: string } | null;
    } | null => {
      const raw = row as PracticeAnswerRowRaw;
      if (typeof raw.id !== "string" || typeof raw.question_order !== "number") return null;

      return {
        id: raw.id,
        question_order: raw.question_order,
        selected_option_id: typeof raw.selected_option_id === "string" ? raw.selected_option_id : null,
        is_correct: typeof raw.is_correct === "boolean" ? raw.is_correct : null,
        options_order: raw.options_order,
        question: normalizeQuestion(raw.question),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}

function orderOptions(
  options: Array<{ id: string; text: string; isCorrect: boolean }>,
  orderRaw: unknown
) {
  if (!Array.isArray(orderRaw)) return options;

  const ids = orderRaw.filter((value): value is string => typeof value === "string");
  if (ids.length !== options.length) return options;

  const map = new Map(options.map((option) => [option.id, option]));
  const ordered = ids.map((id) => map.get(id)).filter((entry): entry is (typeof options)[number] => Boolean(entry));
  return ordered.length === options.length ? ordered : options;
}

function initialQuestionOrder(q: string | undefined, total: number): number {
  const value = Number(q || 1);
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(total, value));
}

export default async function PracticePage({
  searchParams,
}: {
  searchParams?: Promise<PracticeSearchParams>;
}) {
  const user = await requireUser();
  const supabase = await createClient();
  const params = (await searchParams) || {};

  const sessionId = String(params.session || "").trim();

  if (!sessionId) {
    redirect("/dashboard?error=practice_session_missing");
  }

  const { data: session } = await supabase
    .from("practice_sessions")
    .select("id, status, total_questions, source")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!session) {
    redirect("/dashboard?error=practice_session_missing");
  }

  if (session.status === "completed") {
    redirect(`/practice/results?session=${encodeURIComponent(sessionId)}`);
  }

  const { data: answerRows } = await supabase
    .from("practice_answers")
    .select(
      "id, question_order, selected_option_id, is_correct, options_order, question:assessment_questions(id, category, prompt, options, explanation)"
    )
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .order("question_order", { ascending: true });

  const rows = normalizeRows(answerRows);
  if (rows.length === 0) {
    redirect("/dashboard?error=practice_session_missing");
  }

  const runnerQuestions = rows
    .map((row) => {
      if (!row.question) return null;
      const parsedOptions = parseQuestionOptions(row.question.options);
      if (!parsedOptions) return null;

      const ordered = orderOptions(parsedOptions, row.options_order);
      const correct = ordered.find((option) => option.isCorrect);

      return {
        answerId: row.id,
        questionOrder: row.question_order,
        selectedOptionId: row.selected_option_id,
        isCorrect: row.is_correct,
        category: row.question.category,
        prompt: row.question.prompt,
        explanation: row.question.explanation,
        correctOptionText: correct?.text || null,
        options: ordered.map((option) => ({
          id: option.id,
          text: option.text,
        })),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (runnerQuestions.length === 0) {
    redirect("/dashboard?error=practice_session_missing");
  }

  return (
    <main className="min-h-screen py-8 md:py-10">
      <Container>
        <div className="mx-auto max-w-4xl">
          <section className="rounded-2xl border border-border bg-[#16171a] p-6 md:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Daily Practice</p>
              <h1 className="mt-1 text-3xl font-semibold md:text-4xl">Cinematography Drill</h1>
              <p className="mt-1 text-xs text-muted">
                Source: {String(session.source || "") === "daily_ai" ? "AI-generated" : "Question bank"}
              </p>
            </div>
              <Link
                href="/dashboard"
                className="rounded-xl border border-border bg-[#1a1b1f] px-3 py-2 text-sm font-semibold transition hover:bg-[#22252b]"
              >
                Exit session
              </Link>
            </div>

            <PracticeRunner
              sessionId={sessionId}
              questions={runnerQuestions}
              initialQuestionOrder={initialQuestionOrder(params.q, runnerQuestions.length)}
            />
          </section>
        </div>
      </Container>
    </main>
  );
}
