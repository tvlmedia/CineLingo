"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
  const [queuedNextQuestionOrder, setQueuedNextQuestionOrder] = useState<number | null>(null);
  const [autoAdvancePending, setAutoAdvancePending] = useState(false);
  const [reportStatusByOrder, setReportStatusByOrder] = useState<
    Record<number, "idle" | "sending" | "done" | "error">
  >({});
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const correctCount = useMemo(
    () => localQuestions.filter((question) => question.isCorrect === true).length,
    [localQuestions]
  );
  const sessionCombo = useMemo(() => {
    const ordered = [...localQuestions].sort((a, b) => a.questionOrder - b.questionOrder);
    let combo = 0;
    for (const row of ordered) {
      if (row.isCorrect === true) combo += 1;
      if (row.isCorrect === false) combo = 0;
    }
    return combo;
  }, [localQuestions]);
  const answeredOrders = useMemo(
    () =>
      new Set(
        localQuestions
          .filter((question) => Boolean(question.selectedOptionId))
          .map((question) => question.questionOrder)
      ),
    [localQuestions]
  );

  const currentFeedback = current ? feedbackByOrder[current.questionOrder] || null : null;
  const currentReportStatus = current
    ? reportStatusByOrder[current.questionOrder] || "idle"
    : "idle";

  function clearAutoAdvanceTimer() {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }

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
    clearAutoAdvanceTimer();
    setAutoAdvancePending(false);

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
    if (currentFeedback) {
      moveToNextQuestion(queuedNextQuestionOrder);
      setQueuedNextQuestionOrder(null);
      setErrorMessage(null);
      return;
    }

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

        const nextOrder =
          typeof payload.nextQuestionOrder === "number" ? payload.nextQuestionOrder : null;
        setQueuedNextQuestionOrder(nextOrder);

        if (payload.feedback?.isCorrect && nextOrder !== null) {
          setAutoAdvancePending(true);
          clearAutoAdvanceTimer();
          autoAdvanceTimerRef.current = setTimeout(() => {
            moveToNextQuestion(nextOrder);
            setQueuedNextQuestionOrder(null);
          }, 550);
        } else {
          setAutoAdvancePending(false);
        }
      } catch {
        setErrorMessage("Network error. Try again.");
        setAutoAdvancePending(false);
      }
    });
  }

  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    router.prefetch(`/practice/results?session=${encodeURIComponent(sessionId)}`);
  }, [router, sessionId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!current) return;
      if (event.repeat) return;

      const target = event.target as HTMLElement | null;
      const tag = String(target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") {
        return;
      }

      if (event.key === "Enter") {
        if (!currentFeedback && !current.selectedOptionId) return;
        event.preventDefault();
        void submitCurrentAnswer();
        return;
      }

      if (currentFeedback) return;

      if (event.key === "1" || event.key === "2" || event.key === "3" || event.key === "4") {
        const optionIndex = Number(event.key) - 1;
        const option = current.options[optionIndex];
        if (!option) return;
        event.preventDefault();
        updateSelectedOption(option.id);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, currentFeedback, queuedNextQuestionOrder, submitCurrentAnswer, updateSelectedOption]);

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
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full border border-border bg-[#1b1c20] px-3 py-1 text-xs text-muted">
            Answered {answeredCount}/{localQuestions.length}
          </span>
          <span className="rounded-full border border-border bg-[#1b1c20] px-3 py-1 text-xs text-muted">
            Correct {correctCount}
          </span>
          <span className="rounded-full border border-border bg-[#1b1c20] px-3 py-1 text-xs text-muted">
            Combo x{sessionCombo}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {localQuestions.map((question, index) => {
            const isActive = index === currentIndex;
            const isAnswered = answeredOrders.has(question.questionOrder);
            const isCorrect = question.isCorrect === true;
            const isWrong = question.isCorrect === false;

            return (
              <span
                key={question.answerId}
                className={`h-2.5 w-2.5 rounded-full border ${
                  isActive
                    ? "border-accent bg-accent"
                    : isCorrect
                      ? "border-emerald-400/60 bg-emerald-400/50"
                      : isWrong
                        ? "border-amber-400/60 bg-amber-400/45"
                        : isAnswered
                          ? "border-white/40 bg-white/20"
                          : "border-white/20 bg-transparent"
                }`}
                title={`Q${question.questionOrder}${isCorrect ? " · correct" : isWrong ? " · incorrect" : isAnswered ? " · answered" : ""}`}
              />
            );
          })}
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
          {currentFeedback.isCorrect && autoAdvancePending ? (
            <p className="mt-1 text-xs text-[#d8dbdf]">Correct. Continuing automatically...</p>
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
        <p className="text-xs text-muted">
          Focus mode: choose answer, check feedback, continue. Tip: keys 1-4 + Enter.
        </p>
        <button
          onClick={submitCurrentAnswer}
          disabled={isPending || (!currentFeedback && !current.selectedOptionId)}
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-[#13100a] disabled:opacity-50"
        >
          {isPending
            ? "Saving..."
            : currentFeedback
              ? autoAdvancePending
                ? "Continue now"
                : current.questionOrder === localQuestions.length
                ? "Finish session"
                : "Continue"
              : "Check answer"}
        </button>
      </div>
    </div>
  );
}
