import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui";
import { requireAdminUser } from "@/lib/admin";
import {
  deactivateQuestion,
  reactivateQuestion,
  rewriteQuestionWithAI,
  resolveQuestionReports,
} from "./actions";

type ReportRow = {
  id: string;
  question_id: string | null;
  reason: string;
  details: string | null;
  created_at: string;
  user_id: string | null;
};

type QuestionRow = {
  id: string;
  key: string;
  category: string;
  subtopic: string | null;
  prompt: string;
  explanation: string;
  is_active: boolean;
  created_at: string;
};

export default async function AdminQuestionQueuePage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  await requireAdminUser();
  const supabase = await createClient();
  const params = (await searchParams) || {};
  const status = String(params.status || "");

  const { data: reportRows } = await supabase
    .from("reports")
    .select("id, question_id, reason, details, created_at, user_id")
    .eq("reason", "ambiguous_ai_question")
    .order("created_at", { ascending: false })
    .limit(300);

  const reports = ((reportRows || []) as ReportRow[]).filter((row) => Boolean(row.question_id));
  const uniqueQuestionIds = Array.from(
    new Set(reports.map((row) => String(row.question_id || "")).filter((id) => id.length > 0))
  );

  const { data: questionRows } =
    uniqueQuestionIds.length > 0
      ? await supabase
          .from("assessment_questions")
          .select("id, key, category, subtopic, prompt, explanation, is_active, created_at")
          .in("id", uniqueQuestionIds)
      : { data: [] as QuestionRow[] };

  const questionById = new Map<string, QuestionRow>();
  ((questionRows || []) as QuestionRow[]).forEach((row) => questionById.set(row.id, row));

  const grouped = uniqueQuestionIds
    .map((id) => {
      const question = questionById.get(id);
      if (!question) return null;

      const items = reports.filter((report) => report.question_id === id);
      return {
        question,
        reportCount: items.length,
        latestReportAt: items[0]?.created_at || null,
        latestDetails: items[0]?.details || "",
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((a, b) => b.reportCount - a.reportCount);

  return (
    <main className="min-h-screen py-8 md:py-10">
      <Container>
        <div className="mx-auto max-w-5xl space-y-6">
          <section className="rounded-2xl border border-border bg-[#16171a] p-6 md:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted">Admin</p>
                <h1 className="mt-1 text-3xl font-semibold md:text-4xl">Question Quality Queue</h1>
              </div>
              <Link
                href="/dashboard"
                className="rounded-xl border border-border bg-[#1a1b1f] px-3 py-2 text-sm font-semibold transition hover:bg-[#22252b]"
              >
                Back to dashboard
              </Link>
            </div>

            <p className="mt-3 text-sm text-muted">
              Review user-flagged ambiguous questions from daily practice and resolve quickly.
            </p>

            {status ? (
              <p className="mt-3 rounded-xl border border-border bg-[#1b1c20] px-3 py-2 text-xs text-muted">
                Status: {status}
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-border bg-[#16171a] p-6 md:p-7">
            {grouped.length === 0 ? (
              <p className="rounded-xl border border-border bg-[#1b1c20] px-4 py-3 text-sm text-muted">
                No ambiguous-question reports in queue.
              </p>
            ) : (
              <div className="space-y-4">
                {grouped.map((item) => (
                  <article key={item.question.id} className="rounded-xl border border-border bg-[#1b1c20] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted">
                        {item.question.category}
                        {item.question.subtopic ? ` · ${item.question.subtopic}` : ""}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-border bg-[#23252b] px-2 py-0.5 text-xs text-muted">
                          {item.reportCount} report{item.reportCount > 1 ? "s" : ""}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs ${
                            item.question.is_active
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                              : "border-red-500/30 bg-red-500/10 text-red-200"
                          }`}
                        >
                          {item.question.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>

                    <h2 className="mt-2 text-lg font-semibold">{item.question.prompt}</h2>
                    <p className="mt-2 text-sm text-muted">Explanation: {item.question.explanation}</p>
                    {item.latestDetails ? (
                      <p className="mt-2 text-xs text-muted">Latest report note: {item.latestDetails}</p>
                    ) : null}
                    {item.latestReportAt ? (
                      <p className="mt-1 text-xs text-muted">
                        Last reported: {new Date(item.latestReportAt).toLocaleString()}
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <form action={rewriteQuestionWithAI}>
                        <input type="hidden" name="questionId" value={item.question.id} />
                        <button className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20">
                          Rewrite with AI
                        </button>
                      </form>
                      {item.question.is_active ? (
                        <form action={deactivateQuestion}>
                          <input type="hidden" name="questionId" value={item.question.id} />
                          <button className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/20">
                            Deactivate question
                          </button>
                        </form>
                      ) : (
                        <form action={reactivateQuestion}>
                          <input type="hidden" name="questionId" value={item.question.id} />
                          <button className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20">
                            Reactivate question
                          </button>
                        </form>
                      )}

                      <form action={resolveQuestionReports}>
                        <input type="hidden" name="questionId" value={item.question.id} />
                        <button className="rounded-lg border border-border bg-[#1a1b1f] px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-[#22252b]">
                          Mark reports resolved
                        </button>
                      </form>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </Container>
    </main>
  );
}
