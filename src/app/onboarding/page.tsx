import { Card, Container } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export default async function OnboardingPage() {
  await requireUser();

  return (
    <main className="min-h-screen py-16">
      <Container>
        <div className="mx-auto max-w-3xl">
          <Card>
            <p className="mb-3 text-sm uppercase tracking-[0.2em] text-muted">Onboarding</p>
            <h1 className="mb-4 text-3xl font-bold">Start test coming soon</h1>
            <p className="text-muted">
              This is where CineLingo will later determine your base level and build a custom learning path.
            </p>
          </Card>
        </div>
      </Container>
    </main>
  );
}
