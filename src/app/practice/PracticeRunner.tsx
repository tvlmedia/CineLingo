"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type PracticeQuestionView = {
  answerId: string;
  questionOrder: number;
  category: string;
  prompt: string;
  options: Array<{ id: string; text: string }>;
  selectedOptionId: string | null;
  isCorrect: boolean | null;
  explanation: string;
  correctOptionText: string | null;
};

type Feedback = {
  isCorrect: boolean;
  selectedOptionText: string;
  correctOptionText: string;
  explanation: string;
};

function initialIndex(questions: PracticeQuestionView[], initialQuestionOrder: number): number {
  const fromQuery = questions.findIndex((question) => question.questionOrder === initialQuestionOrder);
  if (fromQuery >= 0) return fromQuery;

  const firstUnanswered = questions.findIndex((question) => !question.selectedOptionId);
  return firstUnanswered >= 0 ? firstUnanswered : 0;
}

export function PracticeRunner({
  sessionId,
  questions,
  initialQuestionOrder,
}: {
  sessionId: string;
  questions: PracticeQuestionView[];
  initialQuestionOrder: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [localQuestions, setLocalQuestions] = useState(questions);
  const [currentIndex, setCurrentIndex] = useState(initialIndex(questions, initialQuestionOrder));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reportStatusByOrder, setReportStatusByOrder] = useState<
    Record<number, "idle" | "sending" | "done" | "error">
  >({});

  const [feedbackByOrder, setFeedbackByOrder] = useState<Record<number, Feedback>>(() => {
    const out: Record<number, Feedback> = {};
    for (const question of questions) {
      if (question.selectedOptionId && question.correctOptionText && question.isCorrect !== null) {
        const selectedText =
          question.options.find((option) => option.id === question.selectedOptionId)?.text || "Selected option";
        out[question.questionOrder] = {
          isCorrect: question.isCorrect,
          selectedOptionText: selectedText,
          correctOptionText: question.correctOptionText,
          explanation: question.explanation,
        };
      }
    }
    return out;
  });

  const current = localQuestions[currentIndex];

  const answeredCount = useMemo(
    () => localQuestions.filter((question) => question.selectedOptionId).length,
    [localQuestions]
  );

  const progressPercent = Math.round((answeredCount / localQuestions.length) * 100);

  const currentFeedback = current ? feedbackByOrder[current.questionOrder] || null : null;
  const currentReportStatus = current
    ? reportStatusByOrder[current.questionOrder] || "idle"
    : "idle";

  function updateSelectedOption(optionId: string) {
    if (!current || currentFeedback) {
      return;
    }

    setLocalQuestions((rows) =>
      rows.map((row, index) =>
        index === currentIndex
          ? {
              ...row,
              selectedOptionId: optionId,
            }
          : row
      )
    );
  }

  function moveToNextQuestion(nextOrder: number | null) {
    if (nextOrder !== null) {
      const explicitIndex = localQuestions.findIndex((question) => question.questionOrder === nextOrder);
      if (explicitIndex >= 0) {
        setCurrentIndex(explicitIndex);
        return;
      }
    }

    setCurrentIndex((index) => Math.min(index + 1, localQuestions.length - 1));
  }

  async function submitCurrentAnswer() {
    if (!current) return;
    if (!current.selectedOptionId) {
      setErrorMessage("Select an answer first.");
      return;
    }

    setErrorMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/practice/answer", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            answerId: current.answerId,
            selectedOptionId: current.selectedOptionId,
          }),
        });

        const payload = (await response.json()) as {
          ok?: boolean;
          completed?: boolean;
          resultPath?: string;
          nextQuestionOrder?: number;
          error?: string;
          feedback?: Feedback;
        };

        if (!response.ok || payload.error) {
          setErrorMessage("Could not save your answer. Try again.");
          return;
        }

        if (payload.feedback) {
          setFeedbackByOrder((currentFeedbackState) => ({
            ...currentFeedbackState,
            [current.questionOrder]: payload.feedback!,
          }));

          setLocalQuestions((rows) =>
            rows.map((row, index) =>
              index === currentIndex
                ? {
                    ...row,
                    isCorrect: payload.feedback?.isCorrect ?? row.isCorrect,
                    correctOptionText: payload.feedback?.correctOptionText ?? row.correctOptionText,
                  }
                : row
            )
          );
        }

        if (payload.completed) {
          router.push(payload.resultPath || `/practice/results?session=${encodeURIComponent(sessionId)}`);
          return;
        }

        moveToNextQuestion(
          typeof payload.nextQuestionOrder === "number" ? payload.nextQuestionOrder : null
        );
      } catch {
        setErrorMessage("Network error. Try again.");
      }
    });
  }

  async function reportCurrentQuestion() {
    if (!current || !currentFeedback) return;
    if (currentReportStatus === "sending" || currentReportStatus === "done") return;

    setReportStatusByOrder((state) => ({
      ...state,
      [current.questionOrder]: "sending",
    }));

    try {
      const response = await fetch("/api/practice/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          answerId: current.answerId,
          reason: "ambiguous_ai_question",
          details: `Reported from in-session feedback. Selected: ${currentFeedback.selectedOptionText}. Correct shown: ${currentFeedback.correctOptionText}.`,
        }),
      });

      if (!response.ok) {
        setReportStatusByOrder((state) => ({
          ...state,
          [current.questionOrder]: "error",
        }));
        return;
      }

      setReportStatusByOrder((state) => ({
        ...state,
        [current.questionOrder]: "done",
      }));
    } catch {
      setReportStatusByOrder((state) => ({
        ...state,
        [current.questionOrder]: "error",
      }));
    }
  }

  if (!current) {
    return null;
  }

  return (
    <div>
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-xs text-muted">
          <span>
            Question {current.questionOrder} of {localQuestions.length}
          </span>
          <span>{progressPercent}% complete</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-accent" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted">{current.category}</p>
      <h2 className="mb-5 text-2xl font-semibold leading-tight md:text-3xl">{current.prompt}</h2>

      {errorMessage ? (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </p>
      ) : null}

      <div className="space-y-3">
        {current.options.map((option) => {
          const checked = current.selectedOptionId === option.id;
          return (
            <label
              key={option.id}
              className={`block cursor-pointer rounded-xl border px-4 py-3 transition ${
                checked
                  ? "border-accent bg-[#252831]"
                  : "border-border bg-[#1b1c20] hover:bg-[#22252b]"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name={`practice-answer-${current.answerId}`}
                  value={option.id}
                  checked={checked}
                  disabled={Boolean(currentFeedback)}
                  onChange={() => updateSelectedOption(option.id)}
                  className="mt-0.5 h-4 w-4"
                />
                <span className="text-sm md:text-base">{option.text}</span>
              </div>
            </label>
          );
        })}
      </div>

      {currentFeedback ? (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            currentFeedback.isCorrect
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-amber-500/30 bg-amber-500/10 text-amber-200"
          }`}
        >
          <p className="font-semibold">
            {currentFeedback.isCorrect ? "Correct" : "Not quite"}
          </p>
          {!currentFeedback.isCorrect ? (
            <p className="mt-1 text-[#efe4cc]">
              Correct answer: <span className="font-semibold">{currentFeedback.correctOptionText}</span>
            </p>
          ) : null}
          <p className="mt-2 text-[#d8dbdf]">{currentFeedback.explanation}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={reportCurrentQuestion}
              disabled={currentReportStatus === "sending" || currentReportStatus === "done"}
              className="rounded-lg border border-border bg-[#1a1b1f] px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-[#22252b] disabled:opacity-60"
            >
              {currentReportStatus === "sending"
                ? "Reporting..."
                : currentReportStatus === "done"
                  ? "Reported"
                  : "Report ambiguous question"}
            </button>
            {currentReportStatus === "error" ? (
              <span className="text-xs text-red-300">Could not report. Try again.</span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-xs text-muted">Short daily session. Immediate craft feedback.</p>
        <button
          onClick={submitCurrentAnswer}
          disabled={isPending || !current.selectedOptionId}
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-[#13100a] disabled:opacity-50"
        >
          {isPending
            ? "Saving..."
            : current.questionOrder === localQuestions.length
              ? "Finish session"
              : "Check and continue"}
        </button>
      </div>
    </div>
  );
}
