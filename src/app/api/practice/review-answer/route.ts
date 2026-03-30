import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseQuestionOptions } from "@/lib/assessment/engine";
import { updateMissedQuestionProgress } from "@/lib/practice/missed";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const supabase = await createClient();

    const body = (await request.json().catch(() => null)) as
      | { questionId?: string; selectedOptionId?: string }
      | null;

    const questionId = String(body?.questionId || "").trim();
    const selectedOptionId = String(body?.selectedOptionId || "").trim();

    if (!questionId || !selectedOptionId) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    const { data: question, error: questionError } = await supabase
      .from("assessment_questions")
      .select("id, prompt, options, explanation")
      .eq("id", questionId)
      .maybeSingle();

    if (questionError || !question) {
      return NextResponse.json({ error: "question_not_found" }, { status: 404 });
    }

    const options = parseQuestionOptions(question.options);
    if (!options) {
      return NextResponse.json({ error: "question_data_invalid" }, { status: 400 });
    }

    const selected = options.find((option) => option.id === selectedOptionId);
    const correct = options.find((option) => option.isCorrect);

    if (!selected || !correct) {
      return NextResponse.json({ error: "invalid_option" }, { status: 400 });
    }

    const isCorrect = selected.id === correct.id;

    await updateMissedQuestionProgress({
      supabase,
      userId: user.id,
      questionId,
      isCorrect,
    });

    return NextResponse.json({
      ok: true,
      isCorrect,
      selectedOptionText: selected.text,
      correctOptionText: correct.text,
      explanation: String(question.explanation || ""),
    });
  } catch {
    return NextResponse.json({ error: "unknown_error" }, { status: 500 });
  }
}
