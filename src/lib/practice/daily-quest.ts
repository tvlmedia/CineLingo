import type { AssessmentCategory } from "@/lib/assessment/types";

export type DailyQuestId =
  | "complete_1_session"
  | "earn_100_xp"
  | "complete_2_sessions"
  | "weak_discipline_focus";

export type DailyQuestDefinition = {
  id: DailyQuestId;
  title: string;
  description: string;
  bonusXp: number;
  targetValue: number;
  metric: "sessions" | "xp" | "weak_correct";
  discipline?: AssessmentCategory;
};

export type DailyQuestProgress = {
  value: number;
  target: number;
  completed: boolean;
};

const QUEST_ROTATION: DailyQuestDefinition[] = [
  {
    id: "complete_1_session",
    title: "Daily starter",
    description: "Complete 1 practice session today.",
    bonusXp: 25,
    targetValue: 1,
    metric: "sessions",
  },
  {
    id: "earn_100_xp",
    title: "XP push",
    description: "Earn 100 XP today.",
    bonusXp: 25,
    targetValue: 100,
    metric: "xp",
  },
  {
    id: "complete_2_sessions",
    title: "Double run",
    description: "Complete 2 practice sessions today.",
    bonusXp: 35,
    targetValue: 2,
    metric: "sessions",
  },
];

function deterministicHash(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getDailyQuest({
  date = new Date(),
  userId = "",
  weakestDiscipline = null,
}: {
  date?: Date;
  userId?: string;
  weakestDiscipline?: AssessmentCategory | null;
} = {}): DailyQuestDefinition {
  const dayKey = date.toISOString().slice(0, 10);
  const hash = deterministicHash(`${dayKey}:${userId}`);
  const useWeakDisciplineQuest = Boolean(weakestDiscipline) && hash % 3 === 0;

  if (useWeakDisciplineQuest && weakestDiscipline) {
    return {
      id: "weak_discipline_focus",
      title: "Weak area focus",
      description: `Get 3 correct answers in ${weakestDiscipline} today.`,
      bonusXp: 35,
      targetValue: 3,
      metric: "weak_correct",
      discipline: weakestDiscipline,
    };
  }

  const index = hash % QUEST_ROTATION.length;
  return QUEST_ROTATION[index];
}

export function computeDailyQuestProgress(
  quest: DailyQuestDefinition,
  {
    xpToday,
    sessionsToday,
    weakCorrectToday = 0,
  }: {
    xpToday: number;
    sessionsToday: number;
    weakCorrectToday?: number;
  }
): DailyQuestProgress {
  const value =
    quest.metric === "xp"
      ? xpToday
      : quest.metric === "sessions"
        ? sessionsToday
        : weakCorrectToday;
  const target = quest.targetValue;
  return {
    value,
    target,
    completed: value >= target,
  };
}
