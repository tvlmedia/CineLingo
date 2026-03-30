import { parseQuestionOptions, shuffleArray } from "@/lib/assessment/engine";
import { ASSESSMENT_CATEGORIES, type AssessmentCategory } from "@/lib/assessment/types";
import {
  DAILY_PRACTICE_QUESTION_COUNT,
  XP_RULES,
  type DisciplineMastery,
  type PracticeQuestion,
  type PracticeXPBreakdown,
} from "@/lib/practice/types";

type QuestionRow = {
  id: string;
  key: string;
  category: string;
  prompt: string;
  options: unknown;
  explanation: string;
};

function isAssessmentCategory(input: string): input is AssessmentCategory {
  return (ASSESSMENT_CATEGORIES as readonly string[]).includes(input);
}

export function toPracticeQuestion(row: QuestionRow): PracticeQuestion | null {
  if (!isAssessmentCategory(row.category)) return null;
  const options = parseQuestionOptions(row.options);
  if (!options) return null;

  return {
    id: row.id,
    key: row.key,
    category: row.category,
    prompt: row.prompt,
    options,
    explanation: row.explanation,
  };
}

export function buildShuffledOptionOrder(options: Array<{ id: string }>): string[] {
  return shuffleArray(options.map((option) => option.id));
}

export function pickDailyPracticeQuestions(
  questions: PracticeQuestion[],
  weakCategories: AssessmentCategory[]
): PracticeQuestion[] {
  if (questions.length < DAILY_PRACTICE_QUESTION_COUNT) {
    throw new Error("Not enough active questions for daily practice.");
  }

  const usedIds = new Set<string>();
  const selected: PracticeQuestion[] = [];

  const weakTargets = weakCategories.slice(0, 2);
  for (const category of weakTargets) {
    const categoryPool = shuffleArray(questions.filter((question) => question.category === category));
    for (const question of categoryPool) {
      if (selected.length >= 4) break;
      if (usedIds.has(question.id)) continue;
      selected.push(question);
      usedIds.add(question.id);
      if (selected.filter((entry) => entry.category === category).length >= 2) {
        break;
      }
    }
  }

  const randomPool = shuffleArray(questions);
  for (const question of randomPool) {
    if (selected.length >= DAILY_PRACTICE_QUESTION_COUNT) break;
    if (usedIds.has(question.id)) continue;
    selected.push(question);
    usedIds.add(question.id);
  }

  if (selected.length < DAILY_PRACTICE_QUESTION_COUNT) {
    throw new Error("Could not compose full daily practice session.");
  }

  return shuffleArray(selected.slice(0, DAILY_PRACTICE_QUESTION_COUNT));
}

export function computePracticeXP(
  correctCount: number,
  totalQuestions: number,
  nextStreakValue: number
): PracticeXPBreakdown {
  const answerXp = Math.max(0, correctCount) * XP_RULES.correctAnswer;
  const completionBonusXp = totalQuestions > 0 ? XP_RULES.sessionCompletion : 0;
  const perfectBonusXp = correctCount === totalQuestions && totalQuestions > 0 ? XP_RULES.perfectRound : 0;
  const streakBonusXp = Math.min(XP_RULES.maxStreakBonus, Math.max(0, nextStreakValue * 2));
  const totalXp = answerXp + completionBonusXp + perfectBonusXp + streakBonusXp;

  return {
    answerXp,
    completionBonusXp,
    perfectBonusXp,
    streakBonusXp,
    totalXp,
  };
}

export function computeMasteryStatus(totalAnswered: number, accuracyRatio: number): DisciplineMastery {
  if (totalAnswered >= 40 && accuracyRatio >= 0.85) return "Mastered";
  if (totalAnswered >= 20 && accuracyRatio >= 0.7) return "Proficient";
  if (totalAnswered >= 8 && accuracyRatio >= 0.5) return "Developing";
  return "Emerging";
}

export function computeContiguousStreakFromDates(dateStrings: string[], todayIsoDate: string): number {
  const set = new Set(dateStrings);
  if (!set.has(todayIsoDate)) {
    return 0;
  }

  let streak = 0;
  let cursor = new Date(`${todayIsoDate}T00:00:00.000Z`);

  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!set.has(key)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}
