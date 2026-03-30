"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ASSESSMENT_CATEGORIES, type AssessmentCategory } from "@/lib/assessment/types";
import { buildShuffledOptionOrder, toPracticeQuestion } from "@/lib/practice/engine";
import { buildAdaptiveDailyLesson } from "@/lib/practice/lesson-generator";
import { buildLearningProfile, saveLearningProfile, type LearningProfile } from "@/lib/practice/profile";
import { generateAIDailyQuestions } from "@/lib/practice/ai-generator";
import { loadBlockedQuestionIdsForPractice } from "@/lib/practice/question-quality";
import {
  DAILY_GOAL_XP_DEFAULT,
  DAILY_PRACTICE_QUESTION_COUNT,
  type PracticeQuestion,
} from "@/lib/practice/types";

function isAssessmentCategory(value: string): value is AssessmentCategory {
  return (ASSESSMENT_CATEGORIES as readonly string[]).includes(value);
}

function normalizeProfileCategories(value: unknown): AssessmentCategory[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is AssessmentCategory =>
      typeof entry === "string" && isAssessmentCategory(entry)
  );
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

type PracticeStartMode = "adaptive" | "ai_only" | "bank_only";

function parsePracticeStartMode(value: unknown): PracticeStartMode {
  const raw = String(value || "").trim();
  if (raw === "ai_only") return "ai_only";
  if (raw === "bank_only") return "bank_only";
  return "adaptive";
}

type RawQuestionRow = {
  id: unknown;
  key: unknown;
  category: unknown;
  subtopic: unknown;
  difficulty: unknown;
  question_type: unknown;
  role_relevance: unknown;
  prompt: unknown;
  options: unknown;
  explanation: unknown;
};

function mapRawRowsToPracticeQuestions(rows: RawQuestionRow[]): PracticeQuestion[] {
  return rows
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
    .filter((row): row is PracticeQuestion => Boolean(row));
}

export async function startDailyPractice(formData: FormData): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  const forceNew = String(formData.get("forceNew") || "") === "1";
  const mode = parsePracticeStartMode(formData.get("mode"));

  if (mode === "ai_only" && !process.env.OPENAI_API_KEY) {
    redirect(`/dashboard?error=practice_ai_key_missing`);
  }

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

  const bankPromise =
    mode === "ai_only"
      ? null
      : supabase
          .from("assessment_questions")
          .select(
            "id, key, category, subtopic, difficulty, question_type, role_relevance, prompt, options, explanation"
          )
          .eq("is_active", true);

  const aiPromise =
    mode === "bank_only"
      ? null
      : generateAIDailyQuestions({
          learningProfile,
          targetCount: DAILY_PRACTICE_QUESTION_COUNT,
          timeoutMs: mode === "ai_only" ? 4500 : 2400,
        });

  let aiQuestions: PracticeQuestion[] = [];
  let bankRows: RawQuestionRow[] = [];

  if (bankPromise && aiPromise) {
    const [aiResult, bankResult] = await Promise.all([aiPromise, bankPromise]);
    aiQuestions = aiResult;
    if (bankResult.error) {
      redirect(`/dashboard?error=practice_questions_unavailable`);
    }
    bankRows = (bankResult.data || []) as RawQuestionRow[];
  } else if (aiPromise) {
    aiQuestions = await aiPromise;
  } else if (bankPromise) {
    const bankResult = await bankPromise;
    if (bankResult.error) {
      redirect(`/dashboard?error=practice_questions_unavailable`);
    }
    bankRows = (bankResult.data || []) as RawQuestionRow[];
  }

  const bankQuestions = mapRawRowsToPracticeQuestions(bankRows).filter(
    (row) => !blockedQuestionIds.has(row.id)
  );

  let aiSelected: PracticeQuestion[] = [];
  if (aiQuestions.length >= 6) {
    const aiRowsToInsert = aiQuestions
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

    if (aiRowsToInsert.length > 0) {
      const { data: insertedAI, error: insertAIError } = await supabase
        .from("assessment_questions")
        .insert(aiRowsToInsert)
        .select(
          "id, key, category, subtopic, difficulty, question_type, role_relevance, prompt, options, explanation"
        );

      if (!insertAIError && insertedAI && insertedAI.length > 0) {
        aiSelected = mapRawRowsToPracticeQuestions(insertedAI as RawQuestionRow[]);
      }
    }
  }

  let selected: PracticeQuestion[] = [];
  let source = "daily";
  let plan: Record<string, unknown> = {
    mode,
    targetCount: DAILY_PRACTICE_QUESTION_COUNT,
    weakPrimary: learningProfile.weakestDisciplines[0] || null,
    weakSecondary: learningProfile.weakestDisciplines[1] || null,
    weakSubtopics: learningProfile.weakSubtopics.slice(0, 4),
  };

  if (mode === "ai_only") {
    if (aiSelected.length < DAILY_PRACTICE_QUESTION_COUNT) {
      redirect(`/dashboard?error=practice_ai_unavailable`);
    }

    selected = aiSelected.slice(0, DAILY_PRACTICE_QUESTION_COUNT);
    source = "daily_ai";
    plan = {
      ...plan,
      generator: "openai",
      aiGeneratedCount: selected.length,
      fallbackCount: 0,
    };
  } else {
    if (bankQuestions.length < DAILY_PRACTICE_QUESTION_COUNT) {
      redirect(`/dashboard?error=practice_questions_unavailable`);
    }

    const fallback = buildAdaptiveDailyLesson(
      bankQuestions,
      learningProfile,
      missedQuestionIds,
      DAILY_PRACTICE_QUESTION_COUNT
    );

    if (mode === "bank_only") {
      selected = fallback.questions;
      source = "daily";
      plan = {
        ...plan,
        generator: "bank_adaptive",
        aiGeneratedCount: 0,
        fallbackCount: selected.length,
      };
    } else if (aiSelected.length >= DAILY_PRACTICE_QUESTION_COUNT) {
      selected = aiSelected.slice(0, DAILY_PRACTICE_QUESTION_COUNT);
      source = "daily_ai";
      plan = {
        ...plan,
        generator: "openai",
        aiGeneratedCount: selected.length,
        fallbackCount: 0,
      };
    } else if (aiSelected.length > 0) {
      const needed = DAILY_PRACTICE_QUESTION_COUNT - aiSelected.length;
      selected = [...aiSelected, ...fallback.questions.slice(0, needed)];
      source = "daily_ai_hybrid";
      plan = {
        ...plan,
        generator: "openai_hybrid",
        aiGeneratedCount: aiSelected.length,
        fallbackCount: needed,
      };
    } else {
      selected = fallback.questions;
      source = "daily";
      plan = {
        ...plan,
        generator: "bank_adaptive",
        aiGeneratedCount: 0,
        fallbackCount: selected.length,
      };
    }
  }

  if (selected.length < DAILY_PRACTICE_QUESTION_COUNT) {
    redirect(`/dashboard?error=practice_start_failed`);
  }

  plan.selectedQuestionIds = selected.map((q) => q.id);

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
