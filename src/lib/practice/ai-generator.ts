import { ASSESSMENT_CATEGORIES, type AssessmentCategory } from "@/lib/assessment/types";
import type { LearningProfile } from "@/lib/practice/profile";
import type { PracticeQuestion } from "@/lib/practice/types";

type GeneratedQuestionPayload = {
  category: string;
  subtopic: string;
  difficulty: string;
  questionType: string;
  roleRelevance: unknown;
  prompt: string;
  choices: unknown;
  correctIndex: unknown;
  explanation: string;
};

type OpenAIResponseOutput = {
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

const AMBIGUOUS_TERMS = [
  "best",
  "most",
  "typically",
  "generally",
  "usually",
  "principal advantage",
  "which approach",
  "most directly",
  "most commonly",
  "i guess",
] as const;

function isAssessmentCategory(value: string): value is AssessmentCategory {
  return (ASSESSMENT_CATEGORIES as readonly string[]).includes(value);
}

function readOpenAIText(payload: OpenAIResponseOutput): string {
  const chunks = payload.output || [];
  for (const chunk of chunks) {
    const content = chunk.content || [];
    for (const item of content) {
      if (item?.type === "output_text" && typeof item.text === "string") {
        return item.text.trim();
      }
    }
  }
  return "";
}

function extractJsonBlob(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    return fenced[1].trim();
  }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  return text.trim();
}

function normalizeDifficulty(value: string, accuracy: number): "foundation" | "core" | "advanced" {
  if (value === "foundation" || value === "core" || value === "advanced") return value;
  if (accuracy < 0.45) return "foundation";
  if (accuracy < 0.72) return "core";
  return "advanced";
}

function normalizeQuestionType(value: string): "technical" | "interpretive" {
  return value === "technical" ? "technical" : "technical";
}

function normalizeRoleRelevance(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string").slice(0, 4);
}

function hasAmbiguousLanguage(text: string): boolean {
  const normalized = text.toLowerCase();
  return AMBIGUOUS_TERMS.some((term) => normalized.includes(term));
}

function parseGeneratedQuestions(text: string, targetCount: number, accuracy: number): PracticeQuestion[] {
  let raw: unknown;
  try {
    raw = JSON.parse(extractJsonBlob(text));
  } catch {
    return [];
  }

  const questionsRaw = (raw as { questions?: unknown })?.questions;
  if (!Array.isArray(questionsRaw)) return [];

  const out: PracticeQuestion[] = [];

  for (const questionRaw of questionsRaw) {
    if (!questionRaw || typeof questionRaw !== "object") continue;
    const q = questionRaw as GeneratedQuestionPayload;

    const category = typeof q.category === "string" ? q.category : "";
    const prompt = typeof q.prompt === "string" ? q.prompt.trim() : "";
    const explanation = typeof q.explanation === "string" ? q.explanation.trim() : "";
    const subtopic = typeof q.subtopic === "string" ? q.subtopic.trim() : "";

    if (!isAssessmentCategory(category) || !prompt || !explanation) continue;
    if (hasAmbiguousLanguage(prompt) || hasAmbiguousLanguage(explanation)) continue;
    if (!Array.isArray(q.choices) || q.choices.length !== 4) continue;
    if (typeof q.correctIndex !== "number" || q.correctIndex < 0 || q.correctIndex > 3) continue;

    const choiceTexts = q.choices
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0);
    if (choiceTexts.length !== 4) continue;

    const uniqueChoices = new Set(choiceTexts.map((entry) => entry.toLowerCase()));
    if (uniqueChoices.size !== 4) continue;
    if (choiceTexts.some((entry) => hasAmbiguousLanguage(entry))) continue;

    const idBase = crypto.randomUUID().slice(0, 8);
    const options = choiceTexts.map((text, index) => ({
      id: `opt_${idBase}_${index + 1}`,
      text,
      isCorrect: index === q.correctIndex,
    }));

    out.push({
      id: crypto.randomUUID(),
      key: `ai-daily-${Date.now()}-${crypto.randomUUID().slice(0, 12)}`,
      category,
      subtopic: subtopic || "Adaptive Drill",
      difficulty: normalizeDifficulty(typeof q.difficulty === "string" ? q.difficulty : "", accuracy),
      questionType: normalizeQuestionType(typeof q.questionType === "string" ? q.questionType : ""),
      roleRelevance: normalizeRoleRelevance(q.roleRelevance),
      prompt,
      options,
      explanation,
    });

    if (out.length >= targetCount) break;
  }

  return out;
}

export async function generateAIDailyQuestions(input: {
  learningProfile: LearningProfile;
  targetCount: number;
}): Promise<PracticeQuestion[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const { learningProfile, targetCount } = input;
  const weakest = learningProfile.weakestDisciplines.slice(0, 2);
  const strongest = learningProfile.strongestDisciplines.slice(0, 2);
  const accuracy = Number(learningProfile.recentAccuracy || 0);

  const instruction = [
    "Generate personalized cinematography MCQ questions.",
    "Return strict JSON only with shape:",
    '{ "questions": [{ "category": "...", "subtopic": "...", "difficulty": "foundation|core|advanced", "questionType": "technical|interpretive", "roleRelevance": ["dop"], "prompt": "...", "choices": ["...","...","...","..."], "correctIndex": 0, "explanation": "..." }] }',
    `Generate exactly ${targetCount} questions.`,
    `Allowed categories only: ${ASSESSMENT_CATEGORIES.join(", ")}.`,
    "CRITICAL: only produce objective, factual, technically verifiable questions with one unambiguous correct answer.",
    "Do not produce taste/style/tradeoff questions where multiple answers can be valid.",
    "Avoid wording like: best, most, typically, generally, usually, principal advantage, which approach.",
    "All choices must be unique. Exactly one correct choice. The other 3 must be clearly false on factual grounds.",
    "Question type must be technical.",
    "Questions must be concise and set-practical for professional filmmakers.",
    `User role focus: ${learningProfile.roleFocus || "not specified"}.`,
    `Weakest disciplines (prioritize): ${weakest.join(", ") || "none"}.`,
    `Strongest disciplines (include 1-2 stretch items): ${strongest.join(", ") || "none"}.`,
    `Weak subtopics to target: ${learningProfile.weakSubtopics.join(", ") || "none"}.`,
    `Recent accuracy ratio: ${accuracy.toFixed(2)}.`,
  ].join("\n");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
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
          input: instruction,
          max_output_tokens: 1400,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) return [];

    const payload = (await response.json()) as OpenAIResponseOutput;
    const text = readOpenAIText(payload);
    if (!text) return [];

    return parseGeneratedQuestions(text, targetCount, accuracy);
  } catch {
    return [];
  }
}
