"use server";

import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

function toQueuePath(status: string) {
  return `/admin/questions?status=${encodeURIComponent(status)}`;
}

export async function deactivateQuestion(formData: FormData): Promise<void> {
  await requireAdminUser();
  const supabase = await createClient();
  const questionId = String(formData.get("questionId") || "").trim();
  if (!questionId) redirect(toQueuePath("invalid_question"));

  const { error } = await supabase
    .from("assessment_questions")
    .update({ is_active: false })
    .eq("id", questionId);

  if (error) redirect(toQueuePath("deactivate_failed"));
  redirect(toQueuePath("deactivated"));
}

export async function reactivateQuestion(formData: FormData): Promise<void> {
  await requireAdminUser();
  const supabase = await createClient();
  const questionId = String(formData.get("questionId") || "").trim();
  if (!questionId) redirect(toQueuePath("invalid_question"));

  const { error } = await supabase
    .from("assessment_questions")
    .update({ is_active: true })
    .eq("id", questionId);

  if (error) redirect(toQueuePath("reactivate_failed"));
  redirect(toQueuePath("reactivated"));
}

export async function resolveQuestionReports(formData: FormData): Promise<void> {
  await requireAdminUser();
  const supabase = await createClient();
  const questionId = String(formData.get("questionId") || "").trim();
  if (!questionId) redirect(toQueuePath("invalid_question"));

  const { error } = await supabase
    .from("reports")
    .delete()
    .eq("question_id", questionId)
    .eq("reason", "ambiguous_ai_question");

  if (error) redirect(toQueuePath("resolve_failed"));
  redirect(toQueuePath("resolved"));
}

