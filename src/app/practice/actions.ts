"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ASSESSMENT_CATEGORIES, type AssessmentCategory } from "@/lib/assessment/types";
import {
  buildShuffledOptionOrder,
  pickDailyPracticeQuestions,
  toPracticeQuestion,
} from "@/lib/practice/engine";
import { DAILY_GOAL_XP_DEFAULT } from "@/lib/practice/types";

function isAssessmentCategory(value: string): value is AssessmentCategory {
  return (ASSESSMENT_CATEGORIES as readonly string[]).includes(value);
}

async function getWeakCategories(userId: string): Promise<AssessmentCategory[]> {
  const supabase = await createClient();

  const { data: disciplineRows } = await supabase
    .from("user_discipline_progress")
    .select("category, total_answered, total_correct")
    .eq("user_id", userId);

  const fromDiscipline = (disciplineRows || [])
    .map((row) => {
      const category = String(row.category || "");
      if (!isAssessmentCategory(category)) return null;

      const totalAnswered = Number(row.total_answered || 0);
      const totalCorrect = Number(row.total_correct || 0);
      const ratio = totalAnswered > 0 ? totalCorrect / totalAnswered : 0;

      return { category, ratio, totalAnswered };
    })
    .filter((row): row is { category: AssessmentCategory; ratio: number; totalAnswered: number } => Boolean(row))
    .filter((row) => row.totalAnswered > 0)
    .sort((a, b) => a.ratio - b.ratio)
    .map((row) => row.category);

  if (fromDiscipline.length > 0) {
    return fromDiscipline;
  }

  const { data: latestAttempt } = await supabase
    .from("assessment_attempts")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestAttempt?.id) {
    return [...ASSESSMENT_CATEGORIES];
  }

  const { data: scoreRows } = await supabase
    .from("user_assessment_scores")
    .select("category, correct_count, question_count")
    .eq("attempt_id", latestAttempt.id)
    .eq("user_id", userId);

  const fromAssessment = (scoreRows || [])
    .map((row) => {
      const category = String(row.category || "");
      if (!isAssessmentCategory(category)) return null;

      const correct = Number(row.correct_count || 0);
      const total = Number(row.question_count || 0);
      const ratio = total > 0 ? correct / total : 0;

      return { category, ratio };
    })
    .filter((row): row is { category: AssessmentCategory; ratio: number } => Boolean(row))
    .sort((a, b) => a.ratio - b.ratio)
    .map((row) => row.category);

  if (fromAssessment.length > 0) {
    return fromAssessment;
  }

  return [...ASSESSMENT_CATEGORIES];
}

export async function startDailyPractice(formData: FormData): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  const forceNew = String(formData.get("forceNew") || "") === "1";

  const { data: existingInProgress } = await supabase
    .from("practice_sessions")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingInProgress?.id && !forceNew) {
    redirect(`/practice?session=${encodeURIComponent(String(existingInProgress.id))}&q=1`);
  }

  if (existingInProgress?.id && forceNew) {
    await supabase
      .from("practice_sessions")
      .delete()
      .eq("id", existingInProgress.id)
      .eq("user_id", user.id)
      .eq("status", "in_progress");
  }

  const { data: questionRows, error: questionError } = await supabase
    .from("assessment_questions")
    .select("id, key, category, prompt, options, explanation")
    .eq("is_active", true);

  if (questionError) {
    redirect(`/dashboard?error=practice_questions_unavailable`);
  }

  const questions = (questionRows || [])
    .map((row) =>
      toPracticeQuestion({
        id: String(row.id),
        key: String(row.key),
        category: String(row.category),
        prompt: String(row.prompt),
        options: row.options,
        explanation: String(row.explanation),
      })
    )
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (questions.length < 10) {
    redirect(`/dashboard?error=practice_questions_unavailable`);
  }

  const weakCategories = await getWeakCategories(user.id);
  const selected = pickDailyPracticeQuestions(questions, weakCategories);

  const { data: session, error: sessionError } = await supabase
    .from("practice_sessions")
    .insert({
      user_id: user.id,
      source: "daily",
      status: "in_progress",
      total_questions: selected.length,
      correct_count: 0,
      xp_earned: 0,
      goal_target_xp: DAILY_GOAL_XP_DEFAULT,
    })
    .select("id")
    .single();

  if (sessionError || !session?.id) {
    redirect(`/dashboard?error=practice_start_failed`);
  }

  const sessionId = String(session.id);

  const answerRows = selected.map((question, index) => ({
    session_id: sessionId,
    user_id: user.id,
    question_id: question.id,
    question_order: index + 1,
    options_order: buildShuffledOptionOrder(question.options),
  }));

  const { error: answersError } = await supabase.from("practice_answers").insert(answerRows);

  if (answersError) {
    await supabase.from("practice_sessions").delete().eq("id", sessionId).eq("user_id", user.id);
    redirect(`/dashboard?error=practice_start_failed`);
  }

  redirect(`/practice?session=${encodeURIComponent(sessionId)}&q=1`);
}
