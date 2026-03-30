export async function loadBlockedQuestionIdsForPractice(
  supabase: any,
  userId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("reports")
    .select("question_id, user_id")
    .eq("reason", "ambiguous_ai_question")
    .not("question_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1500);

  if (error || !Array.isArray(data) || data.length === 0) {
    return new Set<string>();
  }

  const countByQuestion = new Map<string, number>();
  const reportedByCurrentUser = new Set<string>();

  for (const row of data) {
    const questionId = String(row.question_id || "").trim();
    if (!questionId) continue;
    countByQuestion.set(questionId, Number(countByQuestion.get(questionId) || 0) + 1);
    if (String(row.user_id || "") === userId) {
      reportedByCurrentUser.add(questionId);
    }
  }

  const blocked = new Set<string>();
  for (const [questionId, total] of countByQuestion.entries()) {
    // Block quickly for the reporting user, and globally after enough reports.
    if (reportedByCurrentUser.has(questionId) || total >= 2) {
      blocked.add(questionId);
    }
  }

  return blocked;
}

