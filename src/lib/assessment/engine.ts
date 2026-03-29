import {
  ASSESSMENT_CATEGORIES,
  type AssessmentBand,
  type AssessmentCategory,
  type AssessmentOption,
  type AssessmentQuestion,
  type CategoryScore,
} from "@/lib/assessment/types";

export const QUESTIONS_PER_CATEGORY = 5;
export const TOTAL_ASSESSMENT_QUESTIONS = ASSESSMENT_CATEGORIES.length * QUESTIONS_PER_CATEGORY;

export function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function scoreBand(correct: number, total: number): AssessmentBand {
  if (total <= 0) {
    return "Weak";
  }

  const ratio = correct / total;
  if (ratio >= 1) return "Strong";
  if (ratio >= 0.8) return "Solid";
  if (ratio >= 0.4) return "Developing";
  return "Weak";
}

export function categoryInterpretation(correct: number, total: number): string {
  const band = scoreBand(correct, total);
  if (band === "Strong") return "Excellent control and consistency in this discipline.";
  if (band === "Solid") return "Strong base. A few refinements can push this to top-level.";
  if (band === "Developing") return "Foundational understanding is present, but still uneven.";
  return "This area needs focused practice and review of core principles.";
}

export function totalInterpretation(correct: number, total: number): string {
  const band = scoreBand(correct, total);
  if (band === "Strong") return "High readiness. You can move into advanced scenario-based learning.";
  if (band === "Solid") return "Good baseline. Mixed-difficulty modules are the best next step.";
  if (band === "Developing") return "You have potential, but core mechanics need structured reinforcement.";
  return "Start with fundamentals-first modules to build confidence and decision speed.";
}

export function parseQuestionOptions(raw: unknown): AssessmentOption[] | null {
  if (!Array.isArray(raw)) return null;

  const options: AssessmentOption[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;

    const obj = item as { id?: unknown; text?: unknown; isCorrect?: unknown };
    if (typeof obj.id !== "string" || typeof obj.text !== "string" || typeof obj.isCorrect !== "boolean") {
      return null;
    }

    options.push({
      id: obj.id,
      text: obj.text,
      isCorrect: obj.isCorrect,
    });
  }

  if (options.length !== 4) return null;
  if (options.filter((option) => option.isCorrect).length !== 1) return null;

  const uniqueIds = new Set(options.map((option) => option.id));
  if (uniqueIds.size !== options.length) return null;

  return options;
}

export function pickAssessmentQuestions(
  questions: AssessmentQuestion[],
  countPerCategory: number = QUESTIONS_PER_CATEGORY
): AssessmentQuestion[] {
  const byCategory = new Map<AssessmentCategory, AssessmentQuestion[]>();

  for (const category of ASSESSMENT_CATEGORIES) {
    byCategory.set(category, []);
  }

  for (const question of questions) {
    byCategory.get(question.category)?.push(question);
  }

  const selected: AssessmentQuestion[] = [];

  for (const category of ASSESSMENT_CATEGORIES) {
    const pool = byCategory.get(category) || [];
    if (pool.length < countPerCategory) {
      throw new Error(`Not enough questions in category: ${category}`);
    }

    selected.push(...shuffleArray(pool).slice(0, countPerCategory));
  }

  return shuffleArray(selected);
}

export function buildShuffledOptionOrder(options: AssessmentOption[]): string[] {
  return shuffleArray(options.map((option) => option.id));
}

export function computeCategoryScores(
  rows: Array<{ category: AssessmentCategory; isCorrect: boolean }>
): CategoryScore[] {
  const scoreByCategory = new Map<AssessmentCategory, { correct: number; total: number }>();

  for (const category of ASSESSMENT_CATEGORIES) {
    scoreByCategory.set(category, { correct: 0, total: 0 });
  }

  for (const row of rows) {
    const current = scoreByCategory.get(row.category);
    if (!current) continue;

    current.total += 1;
    if (row.isCorrect) {
      current.correct += 1;
    }
  }

  return ASSESSMENT_CATEGORIES.map((category) => {
    const values = scoreByCategory.get(category) || { correct: 0, total: 0 };
    return {
      category,
      correct: values.correct,
      total: values.total,
      band: scoreBand(values.correct, values.total),
    };
  });
}
