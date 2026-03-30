export async function updateMissedQuestionProgress(params: {
  supabase: any;
  userId: string;
  questionId: string;
  isCorrect: boolean;
}) {
  const { supabase, userId, questionId, isCorrect } = params;
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("user_missed_questions")
    .select("id, miss_count, correct_review_count, status")
    .eq("user_id", userId)
    .eq("question_id", questionId)
    .maybeSingle();

  if (!isCorrect) {
    if (existing?.id) {
      await supabase
        .from("user_missed_questions")
        .update({
          miss_count: Number(existing.miss_count || 0) + 1,
          status: "open",
          last_missed_at: now,
          updated_at: now,
        })
        .eq("id", existing.id)
        .eq("user_id", userId);
      return;
    }

    await supabase.from("user_missed_questions").insert({
      user_id: userId,
      question_id: questionId,
      miss_count: 1,
      correct_review_count: 0,
      status: "open",
      first_missed_at: now,
      last_missed_at: now,
      updated_at: now,
    });
    return;
  }

  if (!existing?.id) {
    return;
  }

  const nextCorrected = Number(existing.correct_review_count || 0) + 1;
  await supabase
    .from("user_missed_questions")
    .update({
      correct_review_count: nextCorrected,
      status: nextCorrected >= 1 ? "mastered" : String(existing.status || "open"),
      last_reviewed_at: now,
      updated_at: now,
    })
    .eq("id", existing.id)
    .eq("user_id", userId);
}
