"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  ASSESSMENT_CATEGORIES,
  type AssessmentCategory,
  type AssessmentOption,
  type AssessmentQuestion,
} from "@/lib/assessment/types";
import {
  buildShuffledOptionOrder,
  categoryInterpretation,
  computeCategoryScores,
  pickAssessmentQuestions,
  TOTAL_ASSESSMENT_QUESTIONS,
} from "@/lib/assessment/engine";
import { ASSESSMENT_QUESTION_BANK } from "@/lib/assessment/question-bank";

type AssessmentQuestionRow = {
  id: string;
  key: string;
  category: string;
  prompt: string;
  options: unknown;
  explanation: string;
};

function isAssessmentCategory(input: string): input is AssessmentCategory {
  return (ASSESSMENT_CATEGORIES as readonly string[]).includes(input);
}

function parseQuestionOptions(raw: unknown): AssessmentOption[] | null {
  if (!Array.isArray(raw)) return null;

  const options: AssessmentOption[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") return null;

    const candidate = entry as {
      id?: unknown;
      text?: unknown;
      isCorrect?: unknown;
    };

    if (
      typeof candidate.id !== "string" ||
      typeof candidate.text !== "string" ||
      typeof candidate.isCorrect !== "boolean"
    ) {
      return null;
    }

    options.push({
      id: candidate.id,
      text: candidate.text,
      isCorrect: candidate.isCorrect,
    });
  }

  if (options.length !== 4) return null;
  if (options.filter((option) => option.isCorrect).length !== 1) return null;
  return options;
}

function toAssessmentQuestion(row: AssessmentQuestionRow): AssessmentQuestion | null {
  if (!isAssessmentCategory(row.category)) {
    return null;
  }

  const options = parseQuestionOptions(row.options);
  if (!options) {
    return null;
  }

  return {
    id: row.id,
    key: row.key,
    category: row.category,
    prompt: row.prompt,
    options,
    explanation: row.explanation,
  };
}

async function seedQuestionBankIfNeeded(): Promise<string | null> {
  const supabase = await createClient();

  const rows = ASSESSMENT_QUESTION_BANK.map((question) => ({
    key: question.key,
    category: question.category,
    prompt: question.prompt,
    options: question.options,
    explanation: question.explanation,
    is_active: true,
  }));

  // For non-admin users this can fail via RLS; we ignore that and rely on existing DB data.
  const { error } = await supabase.from("assessment_questions").upsert(rows, { onConflict: "key" });
  if (error) {
    return error.message;
  }

  return null;
}

async function getActiveQuestions(): Promise<{ questions: AssessmentQuestion[]; errorMessage: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessment_questions")
    .select("id, key, category, prompt, options, explanation")
    .eq("is_active", true);

  if (error) {
    return { questions: [], errorMessage: error.message };
  }

  const questions = (data || [])
    .map((row) => toAssessmentQuestion(row as AssessmentQuestionRow))
    .filter((row): row is AssessmentQuestion => Boolean(row));

  return { questions, errorMessage: null };
}

async function getLatestInProgressAttemptId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assessment_attempts")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.id as string | undefined) || null;
}

async function finalizeAttemptAndPersist(attemptId: string, userId: string): Promise<void> {
  const supabase = await createClient();

  const { data: answerRows, error } = await supabase
    .from("assessment_answers")
    .select(
      "id, selected_option_id, is_correct, question:assessment_questions(category, explanation, prompt)"
    )
    .eq("attempt_id", attemptId)
    .eq("user_id", userId)
    .order("question_order", { ascending: true });

  if (error || !answerRows || answerRows.length === 0) {
    redirect("/onboarding?error=result_load_failed");
  }

  const unanswered = answerRows.find((row) => !row.selected_option_id);
  if (unanswered) {
    const { data: unansweredRow } = await supabase
      .from("assessment_answers")
      .select("question_order")
      .eq("id", unanswered.id)
      .maybeSingle();

    const questionOrder = Number(unansweredRow?.question_order || 1);
    redirect(`/onboarding/assessment?attempt=${encodeURIComponent(attemptId)}&q=${questionOrder}`);
  }

  const scoringRows = answerRows
    .map((row) => {
      const category = String((row.question as { category?: unknown } | null)?.category || "");
      if (!isAssessmentCategory(category)) {
        return null;
      }

      return {
        category,
        isCorrect: Boolean(row.is_correct),
      };
    })
    .filter((row): row is { category: AssessmentCategory; isCorrect: boolean } => Boolean(row));

  const categoryScores = computeCategoryScores(scoringRows);
  const totalCorrect = scoringRows.filter((row) => row.isCorrect).length;

  await supabase
    .from("assessment_attempts")
    .update({
      status: "completed",
      total_correct: totalCorrect,
      completed_at: new Date().toISOString(),
    })
    .eq("id", attemptId)
    .eq("user_id", userId);

  await supabase.from("user_assessment_scores").delete().eq("attempt_id", attemptId).eq("user_id", userId);

  const scoreRows = categoryScores.map((score) => ({
    user_id: userId,
    attempt_id: attemptId,
    category: score.category,
    correct_count: score.correct,
    question_count: score.total,
    score_band: score.band,
    interpretation: categoryInterpretation(score.correct, score.total),
  }));

  await supabase.from("user_assessment_scores").insert(scoreRows);

  redirect(`/onboarding/results?attempt=${encodeURIComponent(attemptId)}`);
}

export async function startAssessment(formData: FormData): Promise<void> {
  const user = await requireUser();
  const forceNew = String(formData.get("forceNew") || "") === "1";
  const supabase = await createClient();

  const seedError = await seedQuestionBankIfNeeded();

  const activeQuestionResult = await getActiveQuestions();
  if (activeQuestionResult.errorMessage) {
    redirect(
      `/onboarding?error=question_setup_incomplete&debug=${encodeURIComponent(
        `question_select_failed: ${activeQuestionResult.errorMessage}`
      )}`
    );
  }

  const activeQuestions = activeQuestionResult.questions;
  if (activeQuestions.length < TOTAL_ASSESSMENT_QUESTIONS) {
    const debugParts = [`active_question_count=${activeQuestions.length}`];
    if (seedError) {
      debugParts.push(`seed_error=${seedError}`);
    }
    redirect(`/onboarding?error=question_setup_incomplete&debug=${encodeURIComponent(debugParts.join(" | "))}`);
  }

  let selectedQuestions: AssessmentQuestion[];

  try {
    selectedQuestions = pickAssessmentQuestions(activeQuestions, TOTAL_ASSESSMENT_QUESTIONS);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "unknown_category_distribution_problem";
    redirect(`/onboarding?error=question_setup_incomplete&debug=${encodeURIComponent(reason)}`);
  }

  const inProgressAttemptId = await getLatestInProgressAttemptId(user.id);

  if (inProgressAttemptId && !forceNew) {
    redirect(`/onboarding/assessment?attempt=${encodeURIComponent(inProgressAttemptId)}&q=1`);
  }

  if (inProgressAttemptId && forceNew) {
    await supabase.from("assessment_attempts").delete().eq("id", inProgressAttemptId).eq("user_id", user.id);
  }

  const { data: attempt, error: attemptError } = await supabase
    .from("assessment_attempts")
    .insert({
      user_id: user.id,
      status: "in_progress",
      total_questions: selectedQuestions.length,
      total_correct: 0,
    })
    .select("id")
    .single();

  if (attemptError || !attempt?.id) {
    redirect("/onboarding?error=start_failed");
  }

  const attemptId = String(attempt.id);
  const answerRows = selectedQuestions.map((question, index) => ({
    attempt_id: attemptId,
    user_id: user.id,
    question_id: question.id,
    question_order: index + 1,
    options_order: buildShuffledOptionOrder(question.options),
  }));

  const { error: answersError } = await supabase.from("assessment_answers").insert(answerRows);
  if (answersError) {
    await supabase.from("assessment_attempts").delete().eq("id", attemptId).eq("user_id", user.id);
    redirect("/onboarding?error=start_failed");
  }

  redirect(`/onboarding/assessment?attempt=${encodeURIComponent(attemptId)}&q=1`);
}

export async function submitAssessmentAnswer(formData: FormData): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();

  const attemptId = String(formData.get("attemptId") || "").trim();
  const answerId = String(formData.get("answerId") || "").trim();
  const selectedOptionId = String(formData.get("selectedOptionId") || "").trim();

  if (!attemptId || !answerId || !selectedOptionId) {
    redirect(`/onboarding/assessment?attempt=${encodeURIComponent(attemptId)}&error=missing_answer`);
  }

  const { data: attempt } = await supabase
    .from("assessment_attempts")
    .select("id, status")
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!attempt) {
    redirect("/onboarding?error=attempt_not_found");
  }

  if (attempt.status === "completed") {
    redirect(`/onboarding/results?attempt=${encodeURIComponent(attemptId)}`);
  }

  const { data: answerRow, error } = await supabase
    .from("assessment_answers")
    .select("id, question_order, options_order, question:assessment_questions(options)")
    .eq("id", answerId)
    .eq("attempt_id", attemptId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !answerRow) {
    redirect(`/onboarding/assessment?attempt=${encodeURIComponent(attemptId)}&error=answer_not_found`);
  }

  const options = parseQuestionOptions((answerRow.question as { options?: unknown } | null)?.options);
  if (!options) {
    redirect(`/onboarding/assessment?attempt=${encodeURIComponent(attemptId)}&error=question_data_invalid`);
  }

  const chosenOption = options.find((option) => option.id === selectedOptionId);
  if (!chosenOption) {
    redirect(
      `/onboarding/assessment?attempt=${encodeURIComponent(attemptId)}&q=${Number(answerRow.question_order || 1)}&error=invalid_option`
    );
  }

  const { error: updateError } = await supabase
    .from("assessment_answers")
    .update({
      selected_option_id: selectedOptionId,
      is_correct: chosenOption.isCorrect,
      answered_at: new Date().toISOString(),
    })
    .eq("id", answerId)
    .eq("attempt_id", attemptId)
    .eq("user_id", user.id);

  if (updateError) {
    redirect(`/onboarding/assessment?attempt=${encodeURIComponent(attemptId)}&error=save_failed`);
  }

  const { data: firstUnanswered } = await supabase
    .from("assessment_answers")
    .select("question_order")
    .eq("attempt_id", attemptId)
    .eq("user_id", user.id)
    .is("selected_option_id", null)
    .order("question_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!firstUnanswered) {
    await finalizeAttemptAndPersist(attemptId, user.id);
    return;
  }

  const nextOrder = Number(firstUnanswered.question_order || 1);
  redirect(`/onboarding/assessment?attempt=${encodeURIComponent(attemptId)}&q=${nextOrder}`);
}

export async function finalizeAssessment(formData: FormData): Promise<void> {
  const user = await requireUser();
  const attemptId = String(formData.get("attemptId") || "").trim();

  if (!attemptId) {
    redirect("/onboarding?error=attempt_not_found");
  }

  await finalizeAttemptAndPersist(attemptId, user.id);
}

export async function retakeAssessment(): Promise<void> {
  const formData = new FormData();
  formData.set("forceNew", "1");
  await startAssessment(formData);
}
