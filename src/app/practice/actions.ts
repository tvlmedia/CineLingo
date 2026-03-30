"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ASSESSMENT_CATEGORIES, type AssessmentCategory } from "@/lib/assessment/types";
import {
  buildShuffledOptionOrder,
  toPracticeQuestion,
} from "@/lib/practice/engine";
import { buildAdaptiveDailyLesson } from "@/lib/practice/lesson-generator";
import { buildLearningProfile, saveLearningProfile, type LearningProfile } from "@/lib/practice/profile";
import { generateAIDailyQuestions } from "@/lib/practice/ai-generator";
import { loadBlockedQuestionIdsForPractice } from "@/lib/practice/question-quality";
import { DAILY_GOAL_XP_DEFAULT } from "@/lib/practice/types";

function isAssessmentCategory(value: string): value is AssessmentCategory {
  return (ASSESSMENT_CATEGORIES as readonly string[]).includes(value);
}

function normalizeProfileCategories(value: unknown): AssessmentCategory[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is AssessmentCategory => typeof entry === "string" && isAssessmentCategory(entry));
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
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

  const { data: cachedProfileRow } = await supabase
    .from("user_learning_profiles")
    .select(
      "role_focus_snapshot, weakest_disciplines, strongest_disciplines, weak_subtopics, total_xp, weekly_xp, current_streak, recent_accuracy"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  let learningProfile: LearningProfile | null = cachedProfileRow
    ? {
        userId: user.id,
        roleFocus: String(cachedProfileRow.role_focus_snapshot || ""),
        weakestDisciplines: normalizeProfileCategories(cachedProfileRow.weakest_disciplines),
        strongestDisciplines: normalizeProfileCategories(cachedProfileRow.strongest_disciplines),
        weakSubtopics: normalizeStringList(cachedProfileRow.weak_subtopics),
        totalXp: Number(cachedProfileRow.total_xp || 0),
        weeklyXp: Number(cachedProfileRow.weekly_xp || 0),
        currentStreak: Number(cachedProfileRow.current_streak || 0),
        recentAccuracy: Number(cachedProfileRow.recent_accuracy || 0),
      }
    : null;

  if (!learningProfile || learningProfile.weakestDisciplines.length === 0) {
    learningProfile = await buildLearningProfile(supabase, user.id);
    await saveLearningProfile(supabase, learningProfile);
  }
  if (!learningProfile) {
    redirect(`/dashboard?error=practice_start_failed`);
  }

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
  const blockedQuestionIds = await loadBlockedQuestionIdsForPractice(supabase, user.id);

  let selected = [] as NonNullable<ReturnType<typeof toPracticeQuestion>>[];
  let plan: Record<string, unknown> = {};
  let source = "daily";

  const aiQuestions = await generateAIDailyQuestions({
    learningProfile,
    targetCount: 10,
  });

  if (aiQuestions.length >= 6) {
    const aiRows = aiQuestions
      .filter((question) => !blockedQuestionIds.has(question.id))
      .map((question) => ({
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

    if (!insertAIError && insertedAI && insertedAI.length > 0) {
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

  if (selected.length < 10) {
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
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .filter((row) => !blockedQuestionIds.has(row.id));

    if (questions.length < 10) {
      redirect(`/dashboard?error=practice_questions_unavailable`);
    }

    const fallback = buildAdaptiveDailyLesson(
      questions,
      learningProfile,
      missedQuestionIds,
      10
    );
    if (selected.length === 0) {
      selected = fallback.questions;
      plan = fallback.plan;
    } else {
      const needed = 10 - selected.length;
      const fallbackFill = fallback.questions.slice(0, needed);
      selected = [...selected, ...fallbackFill];
      source = "daily_ai";
      plan = {
        generator: "openai_hybrid",
        targetCount: 10,
        aiGeneratedCount: selected.length - fallbackFill.length,
        fallbackCount: fallbackFill.length,
        weakPrimary: learningProfile.weakestDisciplines[0] || null,
        weakSecondary: learningProfile.weakestDisciplines[1] || null,
        weakSubtopics: learningProfile.weakSubtopics.slice(0, 4),
        selectedQuestionIds: selected.map((q) => q.id),
      };
    }
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
