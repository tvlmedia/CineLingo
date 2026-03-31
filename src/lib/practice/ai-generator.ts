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

const SUBJECTIVE_TERMS = [
  "more cinematic",
  "looks better",
  "which style",
  "emotional impact",
  "creative preference",
  "what feels",
  "artistically",
  "most significantly affects",
  "single biggest factor",
  "primary factor",
  "main factor",
  "which factor matters most",
] as const;

const AMBIGUOUS_PROMPT_PATTERNS = [
  /\bwhich is better\b/i,
  /\bmost cinematic\b/i,
  /\bmost effective\b/i,
  /\bbest approach\b/i,
  /\bbest strategy\b/i,
  /\bwhat feels\b/i,
  /\bartistically\b/i,
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

function hasSubjectiveLanguage(text: string): boolean {
  const normalized = text.toLowerCase();
  return SUBJECTIVE_TERMS.some((term) => normalized.includes(term));
}

function hasAmbiguousPromptPattern(text: string): boolean {
  return AMBIGUOUS_PROMPT_PATTERNS.some((pattern) => pattern.test(text));
}

function normalizeForCompare(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function areChoicesTooSimilar(choices: string[]): boolean {
  const normalized = choices.map((entry) => normalizeForCompare(entry));
  for (let i = 0; i < normalized.length; i += 1) {
    for (let j = i + 1; j < normalized.length; j += 1) {
      if (!normalized[i] || !normalized[j]) return true;
      if (normalized[i] === normalized[j]) return true;

      const shorter = normalized[i].length <= normalized[j].length ? normalized[i] : normalized[j];
      const longer = normalized[i].length > normalized[j].length ? normalized[i] : normalized[j];
      if (longer.includes(shorter) && shorter.length >= 24) return true;
    }
  }
  return false;
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
    if (!prompt.endsWith("?")) continue;
    if (prompt.length < 50 || prompt.length > 340) continue;
    if (explanation.length < 60 || explanation.length > 520) continue;
    if (hasSubjectiveLanguage(prompt) || hasSubjectiveLanguage(explanation)) continue;
    if (hasAmbiguousPromptPattern(prompt)) continue;
    if (!Array.isArray(q.choices) || q.choices.length !== 4) continue;
    if (typeof q.correctIndex !== "number" || q.correctIndex < 0 || q.correctIndex > 3) continue;

    const choiceTexts = q.choices
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0);
    if (choiceTexts.length !== 4) continue;
    if (choiceTexts.some((entry) => entry.length < 8 || entry.length > 200)) continue;
    if (choiceTexts.some((entry) => /all of the above|none of the above/i.test(entry))) continue;

    const uniqueChoices = new Set(choiceTexts.map((entry) => entry.toLowerCase()));
    if (uniqueChoices.size !== 4) continue;
    if (choiceTexts.some((entry) => hasSubjectiveLanguage(entry))) continue;
    if (areChoicesTooSimilar(choiceTexts)) continue;

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
  timeoutMs?: number;
  attempts?: number;
}): Promise<PracticeQuestion[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const { learningProfile, targetCount } = input;
  const timeoutMs =
    typeof input.timeoutMs === "number" && input.timeoutMs > 0 ? Math.floor(input.timeoutMs) : 2400;
  const attempts =
    typeof input.attempts === "number" && Number.isFinite(input.attempts)
      ? Math.max(1, Math.min(4, Math.floor(input.attempts)))
      : 1;
  const weakest = learningProfile.weakestDisciplines.slice(0, 2);
  const strongest = learningProfile.strongestDisciplines.slice(0, 2);
  const accuracy = Number(learningProfile.recentAccuracy || 0);

  function buildInstruction(requestCount: number, attemptIndex: number): string {
    const attemptHint =
      attemptIndex === 0
        ? "Attempt mode: strict-objective."
        : "Attempt mode: strict-objective-retry. Use simpler factual mechanics if needed.";

    return [
      "Generate personalized cinematography MCQ questions.",
      "Return strict JSON only with shape:",
      '{ "questions": [{ "category": "...", "subtopic": "...", "difficulty": "foundation|core|advanced", "questionType": "technical|interpretive", "roleRelevance": ["dop"], "prompt": "...", "choices": ["...","...","...","..."], "correctIndex": 0, "explanation": "..." }] }',
      `Generate exactly ${requestCount} questions.`,
      `Allowed categories only: ${ASSESSMENT_CATEGORIES.join(", ")}.`,
      "CRITICAL: only produce objective, factual, technically verifiable questions with one clear correct answer.",
      "Do not produce taste/style/preference questions where multiple answers can be valid.",
      "Avoid ranking-style prompts where more than one option can be defensible (e.g. 'most significant factor').",
      "Prefer definition-based, standards-based, or numeric/mechanical cause-effect questions.",
      "If a prompt can have multiple valid answers in practice, do not include it.",
      "All choices must be unique. Exactly one correct choice. The other 3 must be clearly false on factual grounds.",
      "Question type must be technical.",
      "Questions must be concise and set-practical for professional filmmakers.",
      attemptHint,
      `User role focus: ${learningProfile.roleFocus || "not specified"}.`,
      `Weakest disciplines (prioritize): ${weakest.join(", ") || "none"}.`,
      `Strongest disciplines (include 1-2 stretch items): ${strongest.join(", ") || "none"}.`,
      `Weak subtopics to target: ${learningProfile.weakSubtopics.join(", ") || "none"}.`,
      `Recent accuracy ratio: ${accuracy.toFixed(2)}.`,
    ].join("\n");
  }

  async function generateOnce(requestCount: number, attemptIndex: number): Promise<PracticeQuestion[]> {
    const instruction = buildInstruction(requestCount, attemptIndex);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
            max_output_tokens: 1600,
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

      return parseGeneratedQuestions(text, requestCount, accuracy);
    } catch {
      return [];
    }
  }

  const combined: PracticeQuestion[] = [];
  const seenByPrompt = new Set<string>();

  for (let attemptIndex = 0; attemptIndex < attempts; attemptIndex += 1) {
    const remaining = Math.max(0, targetCount - combined.length);
    if (remaining <= 0) break;

    const generated = await generateOnce(remaining, attemptIndex);
    for (const row of generated) {
      const normalizedPrompt = normalizeForCompare(row.prompt);
      if (!normalizedPrompt || seenByPrompt.has(normalizedPrompt)) continue;
      seenByPrompt.add(normalizedPrompt);
      combined.push(row);
      if (combined.length >= targetCount) break;
    }
  }

  return combined.slice(0, targetCount);
}
