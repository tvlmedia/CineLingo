import {
  ASSESSMENT_CATEGORIES,
  type AssessmentBand,
  type AssessmentCategory,
  type AssessmentOption,
  type AssessmentQuestion,
  type CategoryScore,
} from "@/lib/assessment/types";

export const TOTAL_ASSESSMENT_QUESTIONS = 20;
export const MIN_QUESTIONS_PER_CATEGORY = Math.floor(
  TOTAL_ASSESSMENT_QUESTIONS / ASSESSMENT_CATEGORIES.length
);

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
  totalQuestions: number = TOTAL_ASSESSMENT_QUESTIONS
): AssessmentQuestion[] {
  const byCategory = new Map<AssessmentCategory, AssessmentQuestion[]>();

  for (const category of ASSESSMENT_CATEGORIES) {
    byCategory.set(category, []);
  }

  for (const question of questions) {
    byCategory.get(question.category)?.push(question);
  }

  const selectedByCategory = new Map<AssessmentCategory, AssessmentQuestion[]>();
  const selected: AssessmentQuestion[] = [];

  for (const category of ASSESSMENT_CATEGORIES) {
    const pool = shuffleArray(byCategory.get(category) || []);
    if (pool.length < MIN_QUESTIONS_PER_CATEGORY) {
      throw new Error(`Not enough questions in category: ${category}`);
    }

    const pickedBase = pool.slice(0, MIN_QUESTIONS_PER_CATEGORY);
    selectedByCategory.set(category, pickedBase);
    selected.push(...pickedBase);
  }

  let remaining = totalQuestions - selected.length;
  if (remaining < 0) {
    throw new Error("Total questions is lower than guaranteed per-category minimum.");
  }

  if (remaining > 0) {
    const categoriesWithExtra = shuffleArray(
      ASSESSMENT_CATEGORIES.filter((category) => {
        const pool = byCategory.get(category) || [];
        return pool.length > MIN_QUESTIONS_PER_CATEGORY;
      })
    );

    for (const category of categoriesWithExtra) {
      if (remaining <= 0) break;

      const pool = byCategory.get(category) || [];
      const alreadyPicked = selectedByCategory.get(category) || [];
      const usedIds = new Set(alreadyPicked.map((entry) => entry.id));
      const next = pool.find((entry) => !usedIds.has(entry.id));

      if (next) {
        selected.push(next);
        selectedByCategory.set(category, [...alreadyPicked, next]);
        remaining -= 1;
      }
    }
  }

  if (remaining > 0) {
    throw new Error("Not enough total active questions for requested assessment size.");
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
