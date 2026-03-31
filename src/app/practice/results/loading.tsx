import { Container } from "@/components/ui";

export default function PracticeResultsLoading() {
  return (
    <main className="min-h-screen py-8 md:py-10">
      <Container>
        <div className="mx-auto max-w-4xl space-y-6">
          <section className="rounded-2xl border border-border bg-[#16171a] p-6 md:p-7">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Practice summary</p>
            <h1 className="mt-1 text-3xl font-semibold md:text-4xl">Loading session results...</h1>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="h-[76px] animate-pulse rounded-xl border border-border bg-[#1b1c20]" />
              <div className="h-[76px] animate-pulse rounded-xl border border-border bg-[#1b1c20]" />
              <div className="h-[76px] animate-pulse rounded-xl border border-border bg-[#1b1c20]" />
            </div>
            <div className="mt-4 h-4 w-2/3 animate-pulse rounded bg-[#1b1c20]" />
            <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-[#1b1c20]" />
          </section>

          <section className="rounded-2xl border border-border bg-[#16171a] p-6 md:p-7">
            <div className="h-7 w-56 animate-pulse rounded bg-[#1b1c20]" />
            <div className="mt-4 h-10 w-full animate-pulse rounded-xl bg-[#1b1c20]" />
          </section>
        </div>
      </Container>
    </main>
  );
}

