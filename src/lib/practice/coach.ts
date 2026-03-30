export function generateCoachSummary(input: {
  correctCount: number;
  totalQuestions: number;
  strongestDiscipline: string | null;
  weakestDiscipline: string | null;
  weakSubtopics: string[];
  roleFocus: string;
}) {
  const accuracy = input.totalQuestions > 0 ? Math.round((input.correctCount / input.totalQuestions) * 100) : 0;
  const strongest = input.strongestDiscipline || "overall decision consistency";
  const weakest = input.weakestDiscipline || "core fundamentals";
  const focus = input.weakSubtopics.slice(0, 2).join(" and ") || "foundational execution";

  const tone =
    accuracy >= 80
      ? "Strong session."
      : accuracy >= 60
        ? "Solid progress."
        : "Good effort with clear growth opportunities.";

  const rolePart = input.roleFocus ? ` For your role focus (${input.roleFocus}),` : "";

  const summary = `${tone} You looked most stable in ${strongest}, while ${weakest} needs more reps.${rolePart} tomorrow should emphasize ${focus}.`;
  const nextFocus = `Train ${weakest} with emphasis on ${focus}. Add one stretch set after review.`;

  return {
    summary,
    nextFocus,
  };
}
