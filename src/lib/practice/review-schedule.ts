const HOUR_MS = 1000 * 60 * 60;

const REVIEW_DELAY_BY_STAGE_MS = [
  0, // fresh miss -> review now
  6 * HOUR_MS, // first correct review
  24 * HOUR_MS, // second correct review
  72 * HOUR_MS, // third+ correct review
] as const;

export const REVIEW_CORRECTS_TO_MASTER = 3;

export type MissedReviewState = {
  missCount: number;
  correctReviewCount: number;
  lastMissedAt: string | null;
  lastReviewedAt: string | null;
};

function safeDateMs(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function reviewDelayMs(correctReviewCount: number): number {
  const stage = Math.max(0, Math.min(REVIEW_DELAY_BY_STAGE_MS.length - 1, correctReviewCount));
  return REVIEW_DELAY_BY_STAGE_MS[stage] || 0;
}

export function computeNextReviewAtIso(state: MissedReviewState, now = new Date()): string {
  const lastReviewedMs = safeDateMs(state.lastReviewedAt);
  const lastMissedMs = safeDateMs(state.lastMissedAt);
  const basisMs = lastReviewedMs ?? lastMissedMs ?? now.getTime();
  const dueMs = basisMs + reviewDelayMs(state.correctReviewCount);
  return new Date(dueMs).toISOString();
}

export function isReviewDueNow(state: MissedReviewState, now = new Date()): boolean {
  return Date.parse(computeNextReviewAtIso(state, now)) <= now.getTime();
}

export function dueInMs(state: MissedReviewState, now = new Date()): number {
  return Date.parse(computeNextReviewAtIso(state, now)) - now.getTime();
}

export function formatDueWindowLabel(dueInMilliseconds: number): string {
  if (dueInMilliseconds <= 0) return "Due now";

  const minutes = Math.ceil(dueInMilliseconds / (1000 * 60));
  if (minutes < 60) return `Due in ${minutes}m`;

  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `Due in ${hours}h`;

  const days = Math.ceil(hours / 24);
  return `Due in ${days}d`;
}
