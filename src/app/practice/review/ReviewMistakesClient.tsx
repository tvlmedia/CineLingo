"use client";

import { useMemo, useState, useTransition } from "react";

type ReviewQuestion = {
  missedId: string;
  questionId: string;
  category: string;
  prompt: string;
  explanation: string;
  options: Array<{ id: string; text: string }>;
  missCount: number;
  correctedCount: number;
  lastMissedAt: string | null;
};

type Feedback = {
  isCorrect: boolean;
  selectedOptionText: string;
  correctOptionText: string;
  explanation: string;
};

export function ReviewMistakesClient({ questions }: { questions: ReviewQuestion[] }) {
  const [rows, setRows] = useState(questions);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const current = rows[currentIndex] || null;
  const completedCount = useMemo(() => rows.length - (current ? rows.length - currentIndex : 0), [rows.length, current, currentIndex]);

  function nextQuestion() {
    setSelected(null);
    setFeedback(null);
    setError(null);

    if (currentIndex >= rows.length - 1) {
      return;
    }
    setCurrentIndex((value) => value + 1);
  }

  function submitReview() {
    if (!current || !selected) {
      setError("Select an answer first.");
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/practice/review-answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: current.questionId,
            selectedOptionId: selected,
          }),
        });

        const payload = (await response.json()) as
          | ({
              ok: true;
            } & Feedback)
          | { error?: string };

        if (!response.ok || !("ok" in payload)) {
          setError("Could not save review answer. Try again.");
          return;
        }

        setFeedback({
          isCorrect: payload.isCorrect,
          selectedOptionText: payload.selectedOptionText,
          correctOptionText: payload.correctOptionText,
          explanation: payload.explanation,
        });

        if (payload.isCorrect) {
          const nextLength = Math.max(0, rows.length - 1);
          setRows((existing) => existing.filter((item) => item.questionId !== current.questionId));
          setCurrentIndex((value) => Math.max(0, Math.min(value, nextLength - 1)));
        }
      } catch {
        setError("Network error. Try again.");
      }
    });
  }

  if (!current) {
    return (
      <div className="rounded-xl border border-border bg-[#1b1c20] p-4">
        <p className="text-sm text-muted">All open mistakes reviewed. Keep the streak alive with Daily Practice.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between text-xs text-muted">
        <span>
          Review item {Math.min(currentIndex + 1, rows.length)} of {rows.length}
        </span>
        <span>{completedCount} completed this pass</span>
      </div>

      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted">{current.category}</p>
      <h2 className="mb-3 text-2xl font-semibold leading-tight md:text-3xl">{current.prompt}</h2>
      <p className="mb-4 text-xs text-muted">Missed {current.missCount}x previously</p>

      {error ? (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>
      ) : null}

      <div className="space-y-3">
        {current.options.map((option) => {
          const checked = selected === option.id;
          return (
            <label
              key={option.id}
              className={`block cursor-pointer rounded-xl border px-4 py-3 transition ${
                checked ? "border-accent bg-[#252831]" : "border-border bg-[#1b1c20] hover:bg-[#22252b]"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  checked={checked}
                  disabled={Boolean(feedback)}
                  onChange={() => setSelected(option.id)}
                  className="mt-0.5 h-4 w-4"
                />
                <span className="text-sm md:text-base">{option.text}</span>
              </div>
            </label>
          );
        })}
      </div>

      {feedback ? (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            feedback.isCorrect
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-amber-500/30 bg-amber-500/10 text-amber-200"
          }`}
        >
          <p className="font-semibold">{feedback.isCorrect ? "Correct" : "Not quite"}</p>
          {!feedback.isCorrect ? (
            <p className="mt-1 text-[#efe4cc]">
              Correct answer: <span className="font-semibold">{feedback.correctOptionText}</span>
            </p>
          ) : null}
          <p className="mt-2 text-[#d8dbdf]">{feedback.explanation}</p>
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-xs text-muted">Correctly answered review items are removed from open mistakes.</p>
        {feedback ? (
          <button
            onClick={nextQuestion}
            className="rounded-xl border border-border bg-[#1a1b1f] px-5 py-2.5 text-sm font-semibold transition hover:bg-[#22252b]"
          >
            Next review
          </button>
        ) : (
          <button
            onClick={submitReview}
            disabled={isPending || !selected}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-[#13100a] disabled:opacity-50"
          >
            {isPending ? "Checking..." : "Check answer"}
          </button>
        )}
      </div>
    </div>
  );
}
