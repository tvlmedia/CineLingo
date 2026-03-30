"use server";

import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { parseQuestionOptions } from "@/lib/assessment/engine";

function toQueuePath(status: string) {
  return `/admin/questions?status=${encodeURIComponent(status)}`;
}

function extractJsonBlob(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) return fenced[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text.trim();
}

function readOpenAIText(payload: any): string {
  const output = Array.isArray(payload?.output) ? payload.output : [];
  for (const block of output) {
    const content = Array.isArray(block?.content) ? block.content : [];
    for (const part of content) {
      if (part?.type === "output_text" && typeof part?.text === "string") {
        return part.text.trim();
      }
    }
  }
  return "";
}

function normalizeGeneratedQuestion(rawText: string) {
  let parsed: any;
  try {
    parsed = JSON.parse(extractJsonBlob(rawText));
  } catch {
    return null;
  }

  const prompt = String(parsed?.prompt || "").trim();
  const explanation = String(parsed?.explanation || "").trim();
  const subtopic = String(parsed?.subtopic || "").trim() || "Adaptive Drill";
  const difficultyRaw = String(parsed?.difficulty || "").trim();
  const choices = Array.isArray(parsed?.choices) ? parsed.choices : [];
  const correctIndex = Number(parsed?.correctIndex);

  if (!prompt || !explanation || choices.length !== 4) return null;
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) return null;

  const choiceTexts: string[] = choices
    .map((entry: unknown) => String(entry || "").trim())
    .filter((entry: string) => entry.length > 0);
  if (choiceTexts.length !== 4) return null;

  const unique = new Set(choiceTexts.map((entry: string) => entry.toLowerCase()));
  if (unique.size !== 4) return null;

  const options = choiceTexts.map((text: string, index: number) => ({
    id: `opt_${index + 1}`,
    text,
    isCorrect: index === correctIndex,
  }));

  if (!parseQuestionOptions(options)) return null;

  const difficulty =
    difficultyRaw === "foundation" || difficultyRaw === "core" || difficultyRaw === "advanced"
      ? difficultyRaw
      : "core";

  return {
    prompt,
    explanation,
    subtopic,
    difficulty,
    question_type: "technical",
    role_relevance: [],
    options,
  };
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

export async function rewriteQuestionWithAI(formData: FormData): Promise<void> {
  await requireAdminUser();
  const supabase = await createClient();
  const questionId = String(formData.get("questionId") || "").trim();
  if (!questionId) redirect(toQueuePath("invalid_question"));

  const { data: question, error: questionError } = await supabase
    .from("assessment_questions")
    .select("id, category, subtopic, difficulty, prompt, explanation, options")
    .eq("id", questionId)
    .maybeSingle();

  if (questionError || !question) redirect(toQueuePath("question_not_found"));

  const { data: reports } = await supabase
    .from("reports")
    .select("details")
    .eq("question_id", questionId)
    .eq("reason", "ambiguous_ai_question")
    .order("created_at", { ascending: false })
    .limit(5);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) redirect(toQueuePath("openai_key_missing"));

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const prompt = [
    "Rewrite this multiple-choice cinematography question to be objectively gradable.",
    "Output strict JSON only with keys: prompt, choices, correctIndex, explanation, subtopic, difficulty.",
    "Rules:",
    "- Exactly 4 choices",
    "- Exactly 1 correct answer",
    "- No subjective/style/taste wording",
    "- Avoid 'best/most/typically' style ambiguity",
    "- Keep practical on-set relevance",
    `Category: ${String(question.category || "")}`,
    `Current subtopic: ${String(question.subtopic || "")}`,
    `Current difficulty: ${String(question.difficulty || "core")}`,
    `Current prompt: ${String(question.prompt || "")}`,
    `Current explanation: ${String(question.explanation || "")}`,
    `Current options JSON: ${JSON.stringify(question.options || [])}`,
    `Latest user dispute notes: ${JSON.stringify((reports || []).map((r) => r.details || ""))}`,
  ].join("\n");

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: prompt,
        max_output_tokens: 900,
      }),
    });
  } catch {
    redirect(toQueuePath("rewrite_failed_network"));
  }

  if (!response.ok) redirect(toQueuePath("rewrite_failed_api"));

  const payload = await response.json();
  const rewritten = normalizeGeneratedQuestion(readOpenAIText(payload));
  if (!rewritten) redirect(toQueuePath("rewrite_failed_invalid"));

  const { error: updateError } = await supabase
    .from("assessment_questions")
    .update({
      prompt: rewritten.prompt,
      explanation: rewritten.explanation,
      subtopic: rewritten.subtopic,
      difficulty: rewritten.difficulty,
      question_type: rewritten.question_type,
      role_relevance: rewritten.role_relevance,
      options: rewritten.options,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", questionId);

  if (updateError) redirect(toQueuePath("rewrite_failed_save"));

  await supabase
    .from("reports")
    .delete()
    .eq("question_id", questionId)
    .eq("reason", "ambiguous_ai_question");

  redirect(toQueuePath("rewritten"));
}
