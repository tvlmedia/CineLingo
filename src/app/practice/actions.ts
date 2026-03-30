"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  buildShuffledOptionOrder,
  toPracticeQuestion,
} from "@/lib/practice/engine";
import { buildAdaptiveDailyLesson } from "@/lib/practice/lesson-generator";
import { buildLearningProfile, saveLearningProfile } from "@/lib/practice/profile";
import { generateAIDailyQuestions } from "@/lib/practice/ai-generator";
import { DAILY_GOAL_XP_DEFAULT } from "@/lib/practice/types";

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
    const { error: abandonError } = await supabase
      .from("practice_sessions")
      .update({
        status: "abandoned",
        completed_at: new Date().toISOString(),
      })
      .eq("id", existingInProgress.id)
      .eq("user_id", user.id)
      .eq("status", "in_progress");

    if (abandonError) {
      redirect(`/dashboard?error=practice_abandon_failed`);
    }
  }

  const { data: questionRows, error: questionError } = await supabase
    .from("assessment_questions")
    .select("id, key, category, subtopic, difficulty, question_type, role_relevance, prompt, options, explanation")
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
        subtopic: String(row.subtopic || ""),
        difficulty: String(row.difficulty || ""),
        question_type: String(row.question_type || ""),
        role_relevance: row.role_relevance,
        prompt: String(row.prompt),
        options: row.options,
        explanation: String(row.explanation),
      })
    )
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (questions.length < 10) {
    redirect(`/dashboard?error=practice_questions_unavailable`);
  }

  const learningProfile = await buildLearningProfile(supabase, user.id);
  await saveLearningProfile(supabase, learningProfile);

  const { data: missedRows } = await supabase
    .from("user_missed_questions")
    .select("question_id")
    .eq("user_id", user.id)
    .eq("status", "open")
    .order("last_missed_at", { ascending: false })
    .limit(16);

  const missedQuestionIds = (missedRows || [])
    .map((row) => String(row.question_id || ""))
    .filter((value) => value.length > 0);

  let selected = [] as NonNullable<ReturnType<typeof toPracticeQuestion>>[];
  let plan: Record<string, unknown> = {};
  let source = "daily";

  const aiQuestions = await generateAIDailyQuestions({
    learningProfile,
    targetCount: 10,
  });

  if (aiQuestions.length === 10) {
    const aiRows = aiQuestions.map((question) => ({
      key: question.key,
      category: question.category,
      subtopic: question.subtopic,
      difficulty: question.difficulty,
      question_type: question.questionType,
      role_relevance: question.roleRelevance,
      prompt: question.prompt,
      options: question.options,
      explanation: question.explanation,
      is_active: false,
    }));

    const { data: insertedAI, error: insertAIError } = await supabase
      .from("assessment_questions")
      .insert(aiRows)
      .select("id, key, category, subtopic, difficulty, question_type, role_relevance, prompt, options, explanation");

    if (!insertAIError && insertedAI && insertedAI.length === 10) {
      selected = insertedAI
        .map((row) =>
          toPracticeQuestion({
            id: String(row.id),
            key: String(row.key),
            category: String(row.category),
            subtopic: String(row.subtopic || ""),
            difficulty: String(row.difficulty || ""),
            question_type: String(row.question_type || ""),
            role_relevance: row.role_relevance,
            prompt: String(row.prompt),
            options: row.options,
            explanation: String(row.explanation),
          })
        )
        .filter((row): row is NonNullable<typeof row> => Boolean(row));
    }
  }

  if (selected.length !== 10) {
    const fallback = buildAdaptiveDailyLesson(
      questions,
      learningProfile,
      missedQuestionIds,
      10
    );
    selected = fallback.questions;
    plan = fallback.plan;
  } else {
    source = "daily_ai";
    plan = {
      generator: "openai",
      targetCount: 10,
      weakPrimary: learningProfile.weakestDisciplines[0] || null,
      weakSecondary: learningProfile.weakestDisciplines[1] || null,
      weakSubtopics: learningProfile.weakSubtopics.slice(0, 4),
      selectedQuestionIds: selected.map((q) => q.id),
    };
  }

  const { data: session, error: sessionError } = await supabase
    .from("practice_sessions")
    .insert({
      user_id: user.id,
      source,
      status: "in_progress",
      total_questions: selected.length,
      correct_count: 0,
      xp_earned: 0,
      goal_target_xp: DAILY_GOAL_XP_DEFAULT,
      lesson_date: new Date().toISOString().slice(0, 10),
      generator_version: "adaptive-v1",
      lesson_plan: plan,
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
    await supabase
      .from("practice_sessions")
      .update({
        status: "abandoned",
        completed_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("user_id", user.id);
    redirect(`/dashboard?error=practice_start_failed`);
  }

  redirect(`/practice?session=${encodeURIComponent(sessionId)}&q=1`);
}
