export type CoachSummaryInput = {
  correctCount: number;
  totalQuestions: number;
  strongestDiscipline: string | null;
  weakestDiscipline: string | null;
  weakSubtopics: string[];
  roleFocus: string;
};

export type CoachSummaryResult = {
  summary: string;
  nextFocus: string;
  source: "fallback" | "openai";
};

export function generateCoachSummary(input: CoachSummaryInput): CoachSummaryResult {
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
    source: "fallback",
  };
}

type OpenAIResponseOutput = {
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

function readOpenAIText(payload: OpenAIResponseOutput): string {
  const chunks = payload.output || [];
  for (const chunk of chunks) {
    const content = chunk.content || [];
    for (const item of content) {
      if (item?.type === "output_text" && typeof item.text === "string") {
        return item.text.trim();
      }
    }
  }
  return "";
}

function parseCoachPayload(text: string): { summary: string; nextFocus: string } | null {
  try {
    const parsed = JSON.parse(text) as { summary?: unknown; nextFocus?: unknown };
    if (typeof parsed.summary !== "string" || typeof parsed.nextFocus !== "string") {
      return null;
    }
    const summary = parsed.summary.trim();
    const nextFocus = parsed.nextFocus.trim();
    if (!summary || !nextFocus) return null;
    return { summary, nextFocus };
  } catch {
    return null;
  }
}

export async function generateCoachSummaryWithOpenAI(
  input: CoachSummaryInput
): Promise<CoachSummaryResult> {
  const fallback = generateCoachSummary(input);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;

  try {
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
    const prompt = [
      "You are a cinematography learning coach.",
      "Return strict JSON only with keys: summary, nextFocus.",
      "Style: premium, direct, specific, no fluff, max 2 short sentences per field.",
      `Score: ${input.correctCount}/${input.totalQuestions}`,
      `Strongest discipline: ${input.strongestDiscipline || "Unknown"}`,
      `Weakest discipline: ${input.weakestDiscipline || "Unknown"}`,
      `Weak subtopics: ${input.weakSubtopics.join(", ") || "None detected"}`,
      `Role focus: ${input.roleFocus || "Not set"}`,
    ].join("\n");

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: prompt,
        max_output_tokens: 180,
      }),
    });

    if (!res.ok) return fallback;

    const json = (await res.json()) as OpenAIResponseOutput;
    const text = readOpenAIText(json);
    if (!text) return fallback;

    const parsed = parseCoachPayload(text);
    if (!parsed) return fallback;

    return {
      summary: parsed.summary,
      nextFocus: parsed.nextFocus,
      source: "openai",
    };
  } catch {
    return fallback;
  }
}
