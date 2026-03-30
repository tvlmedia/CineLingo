import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASSESSMENT_CATEGORIES, type AssessmentCategory } from "@/lib/assessment/types";
import { buildLearningProfile, saveLearningProfile, type LearningProfile } from "@/lib/practice/profile";
import { generateAIDailyQuestions } from "@/lib/practice/ai-generator";
import {
  isQuestionRowFresh,
  mapRawRowsToPracticeQuestions,
  type RawQuestionRow,
} from "@/lib/practice/question-rows";
import { DAILY_PRACTICE_QUESTION_COUNT } from "@/lib/practice/types";

const PREWARM_KEY_PREFIX = "prewarm";
const PREWARM_FETCH_LIMIT = 40;
const PREWARM_MAX_AGE_MS = 1000 * 60 * 50;
const PREWARM_TARGET_COUNT = DAILY_PRACTICE_QUESTION_COUNT + 2;

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

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ ok: false, reason: "openai_key_missing" });
    }

    const adminSupabase = createAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ ok: false, reason: "service_role_missing" });
    }

    const { data: cachedRows } = await supabase
      .from("assessment_questions")
      .select(
        "id, key, category, subtopic, difficulty, question_type, role_relevance, prompt, options, explanation, created_at"
      )
      .eq("is_active", false)
      .ilike("key", `${PREWARM_KEY_PREFIX}:${user.id}:%`)
      .order("created_at", { ascending: false })
      .limit(PREWARM_FETCH_LIMIT);

    const freshPrewarmQuestions = mapRawRowsToPracticeQuestions(
      ((cachedRows || []) as RawQuestionRow[]).filter((row) =>
        isQuestionRowFresh(row, PREWARM_MAX_AGE_MS)
      )
    );

    if (freshPrewarmQuestions.length >= DAILY_PRACTICE_QUESTION_COUNT) {
      return NextResponse.json({
        ok: true,
        cached: true,
        availableCount: freshPrewarmQuestions.length,
      });
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
      return NextResponse.json({ ok: false, reason: "profile_missing" });
    }

    const aiQuestions = await generateAIDailyQuestions({
      learningProfile,
      targetCount: PREWARM_TARGET_COUNT,
      timeoutMs: 4200,
    });

    if (aiQuestions.length < 6) {
      return NextResponse.json({ ok: false, reason: "insufficient_quality" });
    }

    const stamp = Date.now();
    const rowsToInsert = aiQuestions.map((question, index) => ({
      key: `${PREWARM_KEY_PREFIX}:${user.id}:${stamp}:${index}:${crypto.randomUUID().slice(0, 8)}`,
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

    const { data: insertedRows, error: insertError } = await adminSupabase
      .from("assessment_questions")
      .insert(rowsToInsert)
      .select(
        "id, key, category, subtopic, difficulty, question_type, role_relevance, prompt, options, explanation, created_at"
      );

    if (insertError) {
      return NextResponse.json({ ok: false, reason: "insert_failed" });
    }

    const staleCutoffIso = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString();
    await adminSupabase
      .from("assessment_questions")
      .delete()
      .eq("is_active", false)
      .ilike("key", `${PREWARM_KEY_PREFIX}:${user.id}:%`)
      .lt("created_at", staleCutoffIso);

    const insertedCount = mapRawRowsToPracticeQuestions((insertedRows || []) as RawQuestionRow[]).length;

    return NextResponse.json({
      ok: true,
      cached: false,
      insertedCount,
    });
  } catch {
    return NextResponse.json({ ok: false, reason: "unknown_error" }, { status: 500 });
  }
}
