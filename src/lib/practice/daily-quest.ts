export type DailyQuestId = "complete_1_session" | "earn_100_xp" | "complete_2_sessions";

export type DailyQuestDefinition = {
  id: DailyQuestId;
  title: string;
  description: string;
  bonusXp: number;
  targetValue: number;
  metric: "sessions" | "xp";
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

export function getDailyQuest(date = new Date()): DailyQuestDefinition {
  const dayNumber = Number(
    date.toISOString().slice(0, 10).replaceAll("-", "")
  );
  const index = Math.abs(dayNumber) % QUEST_ROTATION.length;
  return QUEST_ROTATION[index];
}

export function computeDailyQuestProgress(
  quest: DailyQuestDefinition,
  xpToday: number,
  sessionsToday: number
): DailyQuestProgress {
  const value = quest.metric === "xp" ? xpToday : sessionsToday;
  const target = quest.targetValue;
  return {
    value,
    target,
    completed: value >= target,
  };
}

