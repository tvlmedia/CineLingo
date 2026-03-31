import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { parseQuestionOptions } from "@/lib/assessment/engine";
import {
  computeContiguousStreakFromDates,
  computeMasteryStatus,
  computePracticeXP,
} from "@/lib/practice/engine";
import { buildLearningProfile, saveLearningProfile } from "@/lib/practice/profile";
import { updateMissedQuestionProgress } from "@/lib/practice/missed";
import { generateCoachSummaryWithOpenAI } from "@/lib/practice/coach";
import { DAILY_GOAL_XP_DEFAULT } from "@/lib/practice/types";
import { ASSESSMENT_CATEGORIES, type AssessmentCategory } from "@/lib/assessment/types";
import { computeDailyQuestProgress, getDailyQuest } from "@/lib/practice/daily-quest";

function isAssessmentCategory(value: string): value is AssessmentCategory {
  return (ASSESSMENT_CATEGORIES as readonly string[]).includes(value);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

type JoinedQuestionRaw =
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

function normalizeJoinedQuestion(value: JoinedQuestionRaw): {
  id: string;
  category: string;
  prompt: string;
  options: unknown;
  explanation: string;
} | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || typeof raw !== "object") return null;

  const id = typeof raw.id === "string" ? raw.id : null;
  const category = typeof raw.category === "string" ? raw.category : null;
  const prompt = typeof raw.prompt === "string" ? raw.prompt : null;
  const explanation = typeof raw.explanation === "string" ? raw.explanation : null;

  if (!id || !category || !prompt || !explanation) return null;

  return {
    id,
    category,
    prompt,
    options: raw.options,
    explanation,
  };
}

async function finalizeSessionAndProgress(sessionId: string, userId: string) {
  const supabase = await createClient();
  const today = todayIsoDate();
  const dailyQuest = getDailyQuest(new Date(`${today}T00:00:00.000Z`));

  const { data: sessionRow } = await supabase
    .from("practice_sessions")
    .select("source, lesson_plan")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  const existingLessonPlan =
    sessionRow?.lesson_plan && typeof sessionRow.lesson_plan === "object" && !Array.isArray(sessionRow.lesson_plan)
      ? (sessionRow.lesson_plan as Record<string, unknown>)
      : {};

  const { data: allRows, error: allRowsError } = await supabase
    .from("practice_answers")
    .select(
      "id, selected_option_id, is_correct, question:assessment_questions(category)"
    )
    .eq("session_id", sessionId)
    .eq("user_id", userId);

  if (allRowsError || !allRows || allRows.length === 0) {
    return { error: "result_load_failed" as const };
  }

  const unanswered = allRows.find((row) => !row.selected_option_id);
  if (unanswered) {
    return { error: "not_complete" as const };
  }

  const correctCount = allRows.filter((row) => Boolean(row.is_correct)).length;
  const totalQuestions = allRows.length;

  const sessionCategoryStats = new Map<AssessmentCategory, { total: number; correct: number }>();
  for (const row of allRows) {
    const categoryRaw = String((row.question as { category?: unknown } | null)?.category || "");
    if (!isAssessmentCategory(categoryRaw)) continue;

    const current = sessionCategoryStats.get(categoryRaw) || { total: 0, correct: 0 };
    current.total += 1;
    if (row.is_correct) current.correct += 1;
    sessionCategoryStats.set(categoryRaw, current);
  }

  const { data: streakRows } = await supabase
    .from("user_daily_progress")
    .select("day_date")
    .eq("user_id", userId)
    .gt("sessions_completed", 0)
    .order("day_date", { ascending: false })
    .limit(365);

  const completedDates = (streakRows || []).map((row) => String(row.day_date));
  const nextDates = Array.from(new Set([...completedDates, today]));
  const nextStreak = computeContiguousStreakFromDates(nextDates, today);

  const xp = computePracticeXP(correctCount, totalQuestions, nextStreak);

  const sortedByRatio = Array.from(sessionCategoryStats.entries())
    .map(([category, stats]) => ({
      category,
      ratio: stats.total > 0 ? stats.correct / stats.total : 0,
    }))
    .sort((a, b) => a.ratio - b.ratio);

  const weakestDiscipline = sortedByRatio[0]?.category || null;
  const strongestDiscipline = sortedByRatio[sortedByRatio.length - 1]?.category || null;

  const [{ data: profileRow }, { data: weakSubtopicRows }] = await Promise.all([
    supabase.from("profiles").select("role_focus").eq("id", userId).maybeSingle(),
    supabase
      .from("user_missed_questions")
      .select("question:assessment_questions(subtopic)")
      .eq("user_id", userId)
      .eq("status", "open")
      .order("last_missed_at", { ascending: false })
      .limit(6),
  ]);

  const weakSubtopics = (weakSubtopicRows || [])
    .map((row) => String((Array.isArray(row.question) ? row.question[0] : row.question)?.subtopic || ""))
    .filter((value) => value.length > 0);

  const coach = await generateCoachSummaryWithOpenAI({
    correctCount,
    totalQuestions,
    strongestDiscipline,
    weakestDiscipline,
    weakSubtopics,
    roleFocus: String(profileRow?.role_focus || ""),
  });

  const { data: existingDaily } = await supabase
    .from("user_daily_progress")
    .select("xp_earned, sessions_completed, goal_target_xp")
    .eq("user_id", userId)
    .eq("day_date", today)
    .maybeSingle();

  const existingXp = Number(existingDaily?.xp_earned || 0);
  const existingSessions = Number(existingDaily?.sessions_completed || 0);
  const goalTargetXp = Number(existingDaily?.goal_target_xp || DAILY_GOAL_XP_DEFAULT);
  const projectedXpWithoutQuest = existingXp + xp.totalXp;
  const projectedSessions = existingSessions + 1;

  const { data: priorQuestRewardedRow } = await supabase
    .from("practice_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "completed")
    .eq("lesson_date", today)
    .contains("lesson_plan", { dailyQuestRewardGranted: true })
    .limit(1)
    .maybeSingle();
  const questAlreadyRewarded = Boolean(priorQuestRewardedRow?.id);
  const questProgressAfterSession = computeDailyQuestProgress(
    dailyQuest,
    projectedXpWithoutQuest,
    projectedSessions
  );
  const questBonusXp =
    questProgressAfterSession.completed && !questAlreadyRewarded ? dailyQuest.bonusXp : 0;
  const sessionXpEarned = xp.totalXp + questBonusXp;
  const updatedXp = existingXp + sessionXpEarned;

  const { error: sessionUpdateError } = await supabase
    .from("practice_sessions")
    .update({
      status: "completed",
      correct_count: correctCount,
      xp_earned: sessionXpEarned,
      completed_at: new Date().toISOString(),
      strongest_discipline: strongestDiscipline,
      weakest_discipline: weakestDiscipline,
      coach_summary: coach.summary,
      coach_next_focus: coach.nextFocus,
      lesson_plan: {
        ...existingLessonPlan,
        dailyQuestId: dailyQuest.id,
        dailyQuestTitle: dailyQuest.title,
        dailyQuestMetric: dailyQuest.metric,
        dailyQuestTarget: dailyQuest.targetValue,
        dailyQuestBonusXp: questBonusXp,
        dailyQuestRewardGranted: questBonusXp > 0,
      },
    })
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (sessionUpdateError) {
    return { error: "result_save_failed" as const };
  }

  await supabase.from("user_daily_progress").upsert(
    {
      user_id: userId,
      day_date: today,
      xp_earned: updatedXp,
      sessions_completed: existingSessions + 1,
      current_streak: nextStreak,
      goal_target_xp: goalTargetXp,
      goal_met: updatedXp >= goalTargetXp,
    },
    { onConflict: "user_id,day_date" }
  );

  const categories = Array.from(sessionCategoryStats.keys());
  if (categories.length > 0) {
    const { data: existingDisciplineRows } = await supabase
      .from("user_discipline_progress")
      .select("category, xp_earned, total_answered, total_correct")
      .eq("user_id", userId)
      .in("category", categories);

    const existingByCategory = new Map<string, { xp: number; total: number; correct: number }>();
    (existingDisciplineRows || []).forEach((row) => {
      existingByCategory.set(String(row.category), {
        xp: Number(row.xp_earned || 0),
        total: Number(row.total_answered || 0),
        correct: Number(row.total_correct || 0),
      });
    });

    const upsertRows = categories.map((category) => {
      const stats = sessionCategoryStats.get(category)!;
      const existing = existingByCategory.get(category) || { xp: 0, total: 0, correct: 0 };

      const updatedTotal = existing.total + stats.total;
      const updatedCorrect = existing.correct + stats.correct;
      const updatedXpDiscipline = existing.xp + stats.correct * 10;
      const accuracyRatio = updatedTotal > 0 ? updatedCorrect / updatedTotal : 0;
      const masteryStatus = computeMasteryStatus(updatedTotal, accuracyRatio);

      return {
        user_id: userId,
        category,
        xp_earned: updatedXpDiscipline,
        total_answered: updatedTotal,
        total_correct: updatedCorrect,
        mastery_status: masteryStatus,
        last_practiced_at: new Date().toISOString(),
      };
    });

    await supabase.from("user_discipline_progress").upsert(upsertRows, {
      onConflict: "user_id,category",
    });
  }

  const learningProfile = await buildLearningProfile(supabase, userId);
  await saveLearningProfile(supabase, learningProfile);

  return {
    xp,
    sessionXpEarned,
    questBonusXp,
    dailyQuest,
    dailyQuestCompleted: questProgressAfterSession.completed,
    dailyQuestAlreadyRewarded: questAlreadyRewarded,
    correctCount,
    totalQuestions,
    streak: nextStreak,
    coachSummary: coach.summary,
    coachNextFocus: coach.nextFocus,
  };
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const supabase = await createClient();

    const body = (await request.json().catch(() => null)) as
      | { sessionId?: string; answerId?: string; selectedOptionId?: string }
      | null;

    const sessionId = String(body?.sessionId || "").trim();
    const answerId = String(body?.answerId || "").trim();
    const selectedOptionId = String(body?.selectedOptionId || "").trim();

    if (!sessionId || !answerId || !selectedOptionId) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    const { data: session } = await supabase
      .from("practice_sessions")
      .select("id, status")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!session) {
      return NextResponse.json({ error: "session_not_found" }, { status: 404 });
    }

    if (session.status === "completed") {
      return NextResponse.json({
        ok: true,
        completed: true,
        resultPath: `/practice/results?session=${encodeURIComponent(sessionId)}`,
      });
    }

    const { data: answerRow, error: answerError } = await supabase
      .from("practice_answers")
      .select(
        "id, question_order, selected_option_id, is_correct, question:assessment_questions(id, category, prompt, options, explanation)"
      )
      .eq("id", answerId)
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (answerError || !answerRow) {
      return NextResponse.json({ error: "answer_not_found" }, { status: 404 });
    }

    const question = normalizeJoinedQuestion(
      (answerRow as { question?: JoinedQuestionRaw } | null)?.question ?? null
    );
    const options = parseQuestionOptions(question?.options);

    if (!question || !options) {
      return NextResponse.json({ error: "question_data_invalid" }, { status: 400 });
    }

    const selected = options.find((option) => option.id === selectedOptionId);
    const correct = options.find((option) => option.isCorrect);

    if (!selected || !correct) {
      return NextResponse.json({ error: "invalid_option" }, { status: 400 });
    }

    const isCorrect = selected.id === correct.id;

    const { error: updateError } = await supabase
      .from("practice_answers")
      .update({
        selected_option_id: selectedOptionId,
        is_correct: isCorrect,
        answered_at: new Date().toISOString(),
      })
      .eq("id", answerId)
      .eq("session_id", sessionId)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json({ error: "save_failed" }, { status: 500 });
    }

    await updateMissedQuestionProgress({
      supabase,
      userId: user.id,
      questionId: question.id,
      isCorrect,
    });

    const { data: firstUnanswered } = await supabase
      .from("practice_answers")
      .select("question_order")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .is("selected_option_id", null)
      .order("question_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (firstUnanswered) {
      return NextResponse.json({
        ok: true,
        completed: false,
        nextQuestionOrder: Number(firstUnanswered.question_order),
        feedback: {
          isCorrect,
          selectedOptionText: selected.text,
          correctOptionText: correct.text,
          explanation: question.explanation,
        },
      });
    }

    const final = await finalizeSessionAndProgress(sessionId, user.id);
    if ("error" in final) {
      return NextResponse.json({ error: final.error }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      completed: true,
      resultPath: `/practice/results?session=${encodeURIComponent(sessionId)}`,
      feedback: {
        isCorrect,
        selectedOptionText: selected.text,
        correctOptionText: correct.text,
        explanation: question.explanation,
      },
      summary: {
        xpEarned: final.sessionXpEarned,
        questBonusXp: final.questBonusXp,
        dailyQuest: {
          id: final.dailyQuest.id,
          title: final.dailyQuest.title,
          completed: final.dailyQuestCompleted,
          alreadyRewarded: final.dailyQuestAlreadyRewarded,
        },
        streak: final.streak,
        score: `${final.correctCount}/${final.totalQuestions}`,
        coachSummary: final.coachSummary,
        coachNextFocus: final.coachNextFocus,
      },
    });
  } catch {
    return NextResponse.json({ error: "unknown_error" }, { status: 500 });
  }
}
