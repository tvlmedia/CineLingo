import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import {
  categoryInterpretation,
  computeCategoryScores,
  parseQuestionOptions,
} from "@/lib/assessment/engine";
import {
  ASSESSMENT_CATEGORIES,
  type AssessmentCategory,
} from "@/lib/assessment/types";

function isAssessmentCategory(input: string): input is AssessmentCategory {
  return (ASSESSMENT_CATEGORIES as readonly string[]).includes(input);
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const supabase = await createClient();

    const body = (await request.json()) as {
      attemptId?: string;
      answerId?: string;
      selectedOptionId?: string;
    };

    const attemptId = String(body.attemptId || "").trim();
    const answerId = String(body.answerId || "").trim();
    const selectedOptionId = String(body.selectedOptionId || "").trim();

    if (!attemptId || !answerId || !selectedOptionId) {
      return NextResponse.json({ error: "missing_payload" }, { status: 400 });
    }

    const { data: attempt } = await supabase
      .from("assessment_attempts")
      .select("id, status")
      .eq("id", attemptId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!attempt) {
      return NextResponse.json({ error: "attempt_not_found" }, { status: 404 });
    }

    if (attempt.status === "completed") {
      return NextResponse.json({ ok: true, completed: true });
    }

    const { data: answerRow, error: answerError } = await supabase
      .from("assessment_answers")
      .select("id, question_order, question:assessment_questions(options)")
      .eq("id", answerId)
      .eq("attempt_id", attemptId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (answerError || !answerRow) {
      return NextResponse.json({ error: "answer_not_found" }, { status: 404 });
    }

    const rawQuestion = answerRow.question as { options?: unknown } | Array<{ options?: unknown }> | null;
    const questionData = Array.isArray(rawQuestion) ? rawQuestion[0] : rawQuestion;
    const options = parseQuestionOptions(questionData?.options);
    if (!options) {
      return NextResponse.json({ error: "question_data_invalid" }, { status: 400 });
    }

    const chosenOption = options.find((option) => option.id === selectedOptionId);
    if (!chosenOption) {
      return NextResponse.json({ error: "invalid_option" }, { status: 400 });
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
      return NextResponse.json({ error: "save_failed" }, { status: 500 });
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

    if (firstUnanswered) {
      return NextResponse.json({
        ok: true,
        completed: false,
        nextQuestionOrder: Number(firstUnanswered.question_order || 1),
      });
    }

    const { data: allRows, error: allRowsError } = await supabase
      .from("assessment_answers")
      .select("is_correct, question:assessment_questions(category)")
      .eq("attempt_id", attemptId)
      .eq("user_id", user.id);

    if (allRowsError || !allRows) {
      return NextResponse.json({ error: "result_compute_failed" }, { status: 500 });
    }

    const scoringRows = allRows
      .map((row) => {
        const raw = row.question as { category?: unknown } | Array<{ category?: unknown }> | null;
        const question = Array.isArray(raw) ? raw[0] : raw;
        const category = String(question?.category || "");
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
      .eq("user_id", user.id);

    await supabase.from("user_assessment_scores").delete().eq("attempt_id", attemptId).eq("user_id", user.id);

    const scoreRows = categoryScores.map((score) => ({
      user_id: user.id,
      attempt_id: attemptId,
      category: score.category,
      correct_count: score.correct,
      question_count: score.total,
      score_band: score.band,
      interpretation: categoryInterpretation(score.correct, score.total),
    }));

    await supabase.from("user_assessment_scores").insert(scoreRows);

    return NextResponse.json({ ok: true, completed: true });
  } catch {
    return NextResponse.json({ error: "request_failed" }, { status: 500 });
  }
}
