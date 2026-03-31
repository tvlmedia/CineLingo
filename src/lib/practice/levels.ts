export type DisciplineLevelProgress = {
  level: number;
  currentLevelStartXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  xpNeededForNextLevel: number;
  progressPercent: number;
};

const BASE_XP_PER_LEVEL = 100;
const XP_GROWTH_PER_LEVEL = 30;
const MAX_LEVEL = 50;

function xpCostForLevelStep(level: number): number {
  // Level step means the XP needed to go from `level` to `level + 1`.
  // Example: step(1) => XP to move from L1 -> L2.
  return BASE_XP_PER_LEVEL + (level - 1) * XP_GROWTH_PER_LEVEL;
}

export function xpRequiredForLevel(targetLevel: number): number {
  if (targetLevel <= 1) return 0;
  let total = 0;
  for (let level = 1; level < targetLevel; level += 1) {
    total += xpCostForLevelStep(level);
  }
  return total;
}

export function computeDisciplineLevelProgress(totalXp: number): DisciplineLevelProgress {
  const safeXp = Math.max(0, Number(totalXp || 0));

  let level = 1;
  while (level < MAX_LEVEL && safeXp >= xpRequiredForLevel(level + 1)) {
    level += 1;
  }

  const currentLevelStartXp = xpRequiredForLevel(level);
  const nextLevelXp = level >= MAX_LEVEL ? currentLevelStartXp : xpRequiredForLevel(level + 1);
  const xpIntoLevel = safeXp - currentLevelStartXp;
  const xpNeededForNextLevel = Math.max(1, nextLevelXp - currentLevelStartXp);
  const progressPercent =
    level >= MAX_LEVEL
      ? 100
      : Math.max(0, Math.min(100, Math.round((xpIntoLevel / xpNeededForNextLevel) * 100)));

  return {
    level,
    currentLevelStartXp,
    nextLevelXp,
    xpIntoLevel,
    xpNeededForNextLevel,
    progressPercent,
  };
}

