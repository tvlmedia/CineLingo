import { ASSESSMENT_CATEGORIES, type AssessmentCategory } from "@/lib/assessment/types";

export type LearningProfile = {
  userId: string;
  roleFocus: string;
  weakestDisciplines: AssessmentCategory[];
  strongestDisciplines: AssessmentCategory[];
  weakSubtopics: string[];
  totalXp: number;
  weeklyXp: number;
  currentStreak: number;
  recentAccuracy: number;
};

type DisciplineStat = {
  category: AssessmentCategory;
  total: number;
  correct: number;
  ratio: number;
  xp: number;
};

function toCategory(value: string): AssessmentCategory | null {
  return (ASSESSMENT_CATEGORIES as readonly string[]).includes(value)
    ? (value as AssessmentCategory)
    : null;
}

export async function buildLearningProfile(supabase: any, userId: string): Promise<LearningProfile> {
  const today = new Date();
  const weekStart = new Date();
  weekStart.setUTCDate(today.getUTCDate() - 6);

  const [{ data: profile }, { data: disciplineRows }, { data: dailyRows }, { data: missedRows }, { data: latestAssessmentScores }] = await Promise.all([
    supabase.from("profiles").select("role_focus").eq("id", userId).maybeSingle(),
    supabase
      .from("user_discipline_progress")
      .select("category, xp_earned, total_answered, total_correct")
      .eq("user_id", userId),
    supabase
      .from("user_daily_progress")
      .select("day_date, xp_earned, current_streak")
      .eq("user_id", userId)
      .gte("day_date", weekStart.toISOString().slice(0, 10))
      .order("day_date", { ascending: false }),
    supabase
      .from("user_missed_questions")
      .select("status, miss_count, question:assessment_questions(subtopic)")
      .eq("user_id", userId)
      .eq("status", "open")
      .order("last_missed_at", { ascending: false })
      .limit(30),
    supabase
      .from("user_assessment_scores")
      .select("category, correct_count, question_count")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(24),
  ]);

  const disciplineStats = ((disciplineRows || [])
    .map((row: any) => {
      const category = toCategory(String(row.category || ""));
      if (!category) return null;

      const total = Number(row.total_answered || 0);
      const correct = Number(row.total_correct || 0);
      const ratio = total > 0 ? correct / total : 0;

      return {
        category,
        total,
        correct,
        ratio,
        xp: Number(row.xp_earned || 0),
      };
    })
    .filter((row: any): row is DisciplineStat => Boolean(row))) as DisciplineStat[];

  const fallbackAssessmentStats = ((latestAssessmentScores || [])
    .map((row: any) => {
      const category = toCategory(String(row.category || ""));
      if (!category) return null;

      const total = Number(row.question_count || 0);
      const correct = Number(row.correct_count || 0);
      const ratio = total > 0 ? correct / total : 0;

      return { category, total, correct, ratio, xp: 0 };
    })
    .filter((row: any): row is DisciplineStat => Boolean(row))) as DisciplineStat[];

  const effectiveStats: DisciplineStat[] =
    disciplineStats.length > 0 ? disciplineStats : fallbackAssessmentStats;

  const sortedWeak = [...effectiveStats]
    .filter((row) => row.total > 0)
    .sort((a, b) => a.ratio - b.ratio)
    .map((row) => row.category);

  const sortedStrong = [...effectiveStats]
    .filter((row) => row.total > 0)
    .sort((a, b) => b.ratio - a.ratio)
    .map((row) => row.category);

  const weakSubtopics = (missedRows || [])
    .map((row: any) => String((Array.isArray(row.question) ? row.question[0] : row.question)?.subtopic || ""))
    .filter((value: string) => value.length > 0)
    .slice(0, 5);

  const totalXp = effectiveStats.reduce((sum: number, row) => sum + row.xp, 0);
  const weeklyXp = (dailyRows || []).reduce((sum: number, row: any) => sum + Number(row.xp_earned || 0), 0);
  const currentStreak = Number((dailyRows || [])[0]?.current_streak || 0);

  const recentAccuracyRows = effectiveStats.filter((row) => row.total > 0);
  const recentAccuracy =
    recentAccuracyRows.length > 0
      ? recentAccuracyRows.reduce(
          (sum: number, row: DisciplineStat) => sum + row.ratio,
          0
        ) / recentAccuracyRows.length
      : 0;

  return {
    userId,
    roleFocus: String(profile?.role_focus || ""),
    weakestDisciplines: sortedWeak.length > 0 ? sortedWeak : [...ASSESSMENT_CATEGORIES],
    strongestDisciplines: sortedStrong,
    weakSubtopics,
    totalXp,
    weeklyXp,
    currentStreak,
    recentAccuracy,
  };
}

export async function saveLearningProfile(supabase: any, profile: LearningProfile) {
  await supabase.from("user_learning_profiles").upsert(
    {
      user_id: profile.userId,
      role_focus_snapshot: profile.roleFocus,
      weakest_disciplines: profile.weakestDisciplines,
      strongest_disciplines: profile.strongestDisciplines,
      weak_subtopics: profile.weakSubtopics,
      total_xp: profile.totalXp,
      weekly_xp: profile.weeklyXp,
      current_streak: profile.currentStreak,
      recent_accuracy: profile.recentAccuracy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}
