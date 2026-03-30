"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function reportPracticeQuestion(formData: FormData): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();

  const sessionId = String(formData.get("sessionId") || "").trim();
  const questionId = String(formData.get("questionId") || "").trim();
  const questionOrder = String(formData.get("questionOrder") || "").trim();

  if (!sessionId || !questionId || !questionOrder) {
    redirect(`/practice/results?session=${encodeURIComponent(sessionId)}&error=report_failed`);
  }

  const resultId = `practice:${sessionId}:q${questionOrder}`;
  const reason = "ambiguous_ai_question";

  const { data: existing } = await supabase
    .from("reports")
    .select("id")
    .eq("user_id", user.id)
    .eq("question_id", questionId)
    .eq("result_id", resultId)
    .eq("reason", reason)
    .maybeSingle();

  if (!existing) {
    const details = String(
      formData.get("details") ||
        "User marked this practice question as ambiguous or having multiple valid answers."
    );

    await supabase.from("reports").insert({
      user_id: user.id,
      question_id: questionId,
      result_id: resultId,
      reason,
      details,
    });
  }

  redirect(`/practice/results?session=${encodeURIComponent(sessionId)}&reported=1`);
}

