import type { AssessmentCategory } from "@/lib/assessment/types";
import { shuffleArray } from "@/lib/assessment/engine";
import type { LearningProfile } from "@/lib/practice/profile";
import type { PracticeQuestion } from "@/lib/practice/types";

export type DailyLessonPlan = {
  totalQuestions: number;
  weakPrimary: AssessmentCategory | null;
  weakSecondary: AssessmentCategory | null;
  stretchCategory: AssessmentCategory | null;
  selectedQuestionIds: string[];
};

export type RecoverySprintPlan = {
  totalQuestions: number;
  dueNowUsed: number;
  openQueueUsed: number;
  adaptiveFillUsed: number;
  selectedQuestionIds: string[];
};

function pickFromPool(
  pool: PracticeQuestion[],
  used: Set<string>,
  limit: number,
  predicate?: (q: PracticeQuestion) => boolean
): PracticeQuestion[] {
  const out: PracticeQuestion[] = [];
  const shuffled = shuffleArray(pool);

  for (const question of shuffled) {
    if (out.length >= limit) break;
    if (used.has(question.id)) continue;
    if (predicate && !predicate(question)) continue;

    used.add(question.id);
    out.push(question);
  }

  return out;
}

function roleMatchPredicate(roleFocus: string) {
  const normalized = roleFocus.toLowerCase();
  if (!normalized) return () => true;

  const tags: string[] = [];
  if (normalized.includes("gaffer")) tags.push("gaffer");
  if (normalized.includes("ac")) tags.push("1st_ac");
  if (normalized.includes("director")) tags.push("director");
  if (normalized.includes("dop") || normalized.includes("cinematographer")) tags.push("dop");
  if (normalized.includes("operator")) tags.push("operator");

  if (tags.length === 0) return () => true;
  return (question: PracticeQuestion) => question.roleRelevance.some((tag) => tags.includes(tag));
}

export function buildAdaptiveDailyLesson(
  allQuestions: PracticeQuestion[],
  learningProfile: LearningProfile,
  missedQuestionIds: string[],
  targetCount = 10
): { questions: PracticeQuestion[]; plan: DailyLessonPlan } {
  const used = new Set<string>();
  const selected: PracticeQuestion[] = [];

  const weakPrimary = learningProfile.weakestDisciplines[0] || null;
  const weakSecondary = learningProfile.weakestDisciplines[1] || null;
  const rolePredicate = roleMatchPredicate(learningProfile.roleFocus);

  if (weakPrimary) {
    selected.push(
      ...pickFromPool(
        allQuestions.filter((q) => q.category === weakPrimary),
        used,
        4,
        rolePredicate
      )
    );
  }

  if (weakSecondary) {
    selected.push(
      ...pickFromPool(
        allQuestions.filter((q) => q.category === weakSecondary),
        used,
        3,
        rolePredicate
      )
    );
  }

  if (missedQuestionIds.length > 0) {
    selected.push(
      ...pickFromPool(
        allQuestions.filter((q) => missedQuestionIds.includes(q.id)),
        used,
        2
      )
    );
  }

  const stretchCategory = weakPrimary || weakSecondary || learningProfile.strongestDisciplines[0] || null;

  if (stretchCategory) {
    selected.push(
      ...pickFromPool(
        allQuestions.filter((q) => q.category === stretchCategory),
        used,
        1,
        (q) => q.difficulty === "advanced" && rolePredicate(q)
      )
    );
  }

  if (selected.length < targetCount) {
    selected.push(...pickFromPool(allQuestions, used, targetCount - selected.length));
  }

  const finalQuestions = shuffleArray(selected).slice(0, targetCount);

  return {
    questions: finalQuestions,
    plan: {
      totalQuestions: targetCount,
      weakPrimary,
      weakSecondary,
      stretchCategory,
      selectedQuestionIds: finalQuestions.map((q) => q.id),
    },
  };
}

export function buildRecoverySprintLesson(
  allQuestions: PracticeQuestion[],
  dueNowQuestionIds: string[],
  openQueueQuestionIds: string[],
  adaptiveFallback: PracticeQuestion[],
  targetCount: number
): { questions: PracticeQuestion[]; plan: RecoverySprintPlan } {
  const byId = new Map(allQuestions.map((question) => [question.id, question]));
  const selected: PracticeQuestion[] = [];
  const used = new Set<string>();

  const appendByIds = (ids: string[], limit: number): number => {
    let count = 0;
    for (const id of ids) {
      if (count >= limit) break;
      if (used.has(id)) continue;
      const match = byId.get(id);
      if (!match) continue;
      used.add(id);
      selected.push(match);
      count += 1;
    }
    return count;
  };

  const dueNowUsed = appendByIds(dueNowQuestionIds, targetCount);
  const openQueueUsed = appendByIds(openQueueQuestionIds, targetCount - selected.length);

  let adaptiveFillUsed = 0;
  if (selected.length < targetCount) {
    for (const question of adaptiveFallback) {
      if (selected.length >= targetCount) break;
      if (used.has(question.id)) continue;
      used.add(question.id);
      selected.push(question);
      adaptiveFillUsed += 1;
    }
  }

  const questions = selected.slice(0, targetCount);

  return {
    questions,
    plan: {
      totalQuestions: targetCount,
      dueNowUsed,
      openQueueUsed,
      adaptiveFillUsed,
      selectedQuestionIds: questions.map((question) => question.id),
    },
  };
}
