import { toPracticeQuestion } from "@/lib/practice/engine";
import type { PracticeQuestion } from "@/lib/practice/types";

export type RawQuestionRow = {
  id: unknown;
  key: unknown;
  category: unknown;
  subtopic: unknown;
  difficulty: unknown;
  question_type: unknown;
  role_relevance: unknown;
  prompt: unknown;
  options: unknown;
  explanation: unknown;
  created_at?: unknown;
};

export function mapRawRowsToPracticeQuestions(rows: RawQuestionRow[]): PracticeQuestion[] {
  return rows
    .map((row) =>
      toPracticeQuestion({
        id: String(row.id),
        key: String(row.key),
        category: String(row.category),
        subtopic: String(row.subtopic || ""),
        difficulty: String(row.difficulty || ""),
        question_type: String(row.question_type || ""),
        role_relevance: row.role_relevance,
        prompt: String(row.prompt),
        options: row.options,
        explanation: String(row.explanation),
      })
    )
    .filter((row): row is PracticeQuestion => Boolean(row));
}

export function isQuestionRowFresh(row: RawQuestionRow, maxAgeMs: number, nowMs = Date.now()): boolean {
  const createdAtRaw = row.created_at;
  if (typeof createdAtRaw !== "string" || createdAtRaw.length === 0) return false;

  const createdAtMs = Date.parse(createdAtRaw);
  if (!Number.isFinite(createdAtMs)) return false;

  return nowMs - createdAtMs <= maxAgeMs;
}
