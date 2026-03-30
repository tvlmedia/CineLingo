import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

type JoinedPromptRaw =
  | {
      prompt?: unknown;
    }
  | Array<{
      prompt?: unknown;
    }>
  | null;

function extractPrompt(value: JoinedPromptRaw): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || typeof raw !== "object") return "";
  return typeof raw.prompt === "string" ? raw.prompt : "";
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const supabase = await createClient();

    const body = (await request.json().catch(() => null)) as
      | {
          sessionId?: string;
          answerId?: string;
          reason?: string;
          details?: string;
        }
      | null;

    const sessionId = String(body?.sessionId || "").trim();
    const answerId = String(body?.answerId || "").trim();
    const reason = String(body?.reason || "ambiguous_ai_question").trim();
    const details = String(body?.details || "").trim();

    if (!sessionId || !answerId) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    const { data: row, error: answerError } = await supabase
      .from("practice_answers")
      .select(
        "question_id, question_order, question:assessment_questions(prompt)"
      )
      .eq("id", answerId)
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (answerError || !row?.question_id) {
      return NextResponse.json({ error: "answer_not_found" }, { status: 404 });
    }

    const questionId = String(row.question_id);
    const questionOrder = Number(row.question_order || 0);
    const resultId = `practice:${sessionId}:q${questionOrder}`;

    const { data: existing } = await supabase
      .from("reports")
      .select("id")
      .eq("user_id", user.id)
      .eq("question_id", questionId)
      .eq("result_id", resultId)
      .eq("reason", reason)
      .maybeSingle();

    if (!existing) {
      const prompt = extractPrompt((row as { question?: JoinedPromptRaw } | null)?.question ?? null);

      const { error: insertError } = await supabase.from("reports").insert({
        user_id: user.id,
        question_id: questionId,
        result_id: resultId,
        reason,
        details: details || `Reported during practice. Prompt: ${prompt}`,
      });

      if (insertError) {
        return NextResponse.json({ error: "report_insert_failed" }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "unknown_error" }, { status: 500 });
  }
}
