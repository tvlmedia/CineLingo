import type { AssessmentCategory } from "@/lib/assessment/types";

export const DAILY_PRACTICE_QUESTION_COUNT = 10;
export const DAILY_GOAL_XP_DEFAULT = 50;

export const XP_RULES = {
  correctAnswer: 10,
  sessionCompletion: 20,
  perfectRound: 20,
  maxStreakBonus: 14,
} as const;

export type DisciplineMastery = "Emerging" | "Developing" | "Proficient" | "Mastered";

export type PracticeQuestion = {
  id: string;
  key: string;
  category: AssessmentCategory;
  prompt: string;
  options: Array<{ id: string; text: string; isCorrect: boolean }>;
  explanation: string;
};

export type PracticeXPBreakdown = {
  answerXp: number;
  completionBonusXp: number;
  perfectBonusXp: number;
  streakBonusXp: number;
  totalXp: number;
};
