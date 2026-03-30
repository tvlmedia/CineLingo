"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type RunnerQuestion = {
  answerId: string;
  questionOrder: number;
  category: string;
  prompt: string;
  options: Array<{
    id: string;
    text: string;
  }>;
  selectedOptionId: string | null;
};

function firstUnansweredIndex(questions: RunnerQuestion[]): number {
  const index = questions.findIndex((question) => !question.selectedOptionId);
  return index >= 0 ? index : 0;
}

export function AssessmentRunner({
  attemptId,
  questions,
  initialQuestionOrder,
}: {
  attemptId: string;
  questions: RunnerQuestion[];
  initialQuestionOrder: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const defaultIndex = useMemo(() => {
    const resolved = questions.findIndex((question) => question.questionOrder === initialQuestionOrder);
    if (resolved >= 0) {
      return resolved;
    }
    return firstUnansweredIndex(questions);
  }, [initialQuestionOrder, questions]);

  const [currentIndex, setCurrentIndex] = useState(defaultIndex);
  const [localQuestions, setLocalQuestions] = useState(questions);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const current = localQuestions[currentIndex];
  const answeredCount = localQuestions.filter((question) => question.selectedOptionId).length;
  const progress = Math.round((answeredCount / localQuestions.length) * 100);

  async function onContinue() {
    if (!current) return;

    if (!current.selectedOptionId) {
      setErrorMessage("Kies eerst een antwoord.");
      return;
    }

    setErrorMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/assessment/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId,
            answerId: current.answerId,
            selectedOptionId: current.selectedOptionId,
          }),
        });

        const payload = (await response.json()) as {
          ok?: boolean;
          completed?: boolean;
          nextQuestionOrder?: number;
          error?: string;
        };

        if (!response.ok || payload.error) {
          setErrorMessage("Opslaan mislukt. Probeer opnieuw.");
          return;
        }

        if (payload.completed) {
          router.push(`/onboarding/results?attempt=${encodeURIComponent(attemptId)}`);
          return;
        }

        if (typeof payload.nextQuestionOrder === "number") {
          const nextIndex = localQuestions.findIndex(
            (question) => question.questionOrder === payload.nextQuestionOrder
          );

          if (nextIndex >= 0) {
            setCurrentIndex(nextIndex);
            return;
          }
        }

        setCurrentIndex((value) => Math.min(value + 1, localQuestions.length - 1));
      } catch {
        setErrorMessage("Netwerkfout. Probeer opnieuw.");
      }
    });
  }

  if (!current) {
    return null;
  }

  return (
    <>
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-xs text-muted">
          <span>
            Question {current.questionOrder} of {localQuestions.length}
          </span>
          <span>{progress}% complete</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      </div>

      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted">{current.category}</p>
      <h2 className="mb-5 text-xl font-semibold md:text-2xl">{current.prompt}</h2>

      {errorMessage ? (
        <p className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </p>
      ) : null}

      <div className="space-y-4">
        <div className="space-y-3">
          {current.options.map((option) => {
            const optionId = `${current.answerId}-${option.id}`;
            return (
              <label
                key={option.id}
                htmlFor={optionId}
                className="block cursor-pointer rounded-2xl border border-border bg-white/5 p-4 transition hover:border-accent/70 hover:bg-white/10"
              >
                <div className="flex items-start gap-3">
                  <input
                    id={optionId}
                    type="radio"
                    name={`answer-${current.answerId}`}
                    value={option.id}
                    checked={current.selectedOptionId === option.id}
                    onChange={() => {
                      setLocalQuestions((rows) =>
                        rows.map((row, index) =>
                          index === currentIndex
                            ? {
                                ...row,
                                selectedOptionId: option.id,
                              }
                            : row
                        )
                      );
                    }}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>{option.text}</span>
                </div>
              </label>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-xs text-muted">Snel toetsen zonder volledige page refresh.</p>
          <button
            onClick={onContinue}
            disabled={isPending}
            className="rounded-2xl bg-accent px-5 py-2.5 font-semibold text-[#04231d] disabled:opacity-60"
          >
            {isPending
              ? "Saving..."
              : answeredCount === localQuestions.length && currentIndex === localQuestions.length - 1
                ? "Finish assessment"
                : "Save and continue"}
          </button>
        </div>
      </div>
    </>
  );
}
