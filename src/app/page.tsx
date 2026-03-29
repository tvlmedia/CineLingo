import Link from "next/link";
import { Container, Card, GhostLink } from "@/components/ui";

export default function HomePage() {
  return (
    <main className="min-h-screen py-16">
      <Container>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mb-3 text-sm uppercase tracking-[0.2em] text-muted">
              CineLingo
            </p>
            <h1 className="mb-6 text-5xl font-bold leading-tight">
              Learn cinematography.
              <br />
              Track your growth.
              <br />
              Build your eye.
            </h1>
            <p className="mb-8 max-w-xl text-lg text-muted">
              A social learning platform for filmmakers, DOPs, gaffers and visual storytellers.
            </p>
            <div className="flex flex-wrap gap-4">
              <GhostLink href="/signup">Create account</GhostLink>
              <GhostLink href="/login">Log in</GhostLink>
            </div>
          </div>

          <Card>
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">What’s in v1?</h2>
              <ul className="space-y-3 text-muted">
                <li>• Account system</li>
                <li>• Login / signup</li>
                <li>• Dashboard</li>
                <li>• Profile page</li>
                <li>• Onboarding placeholder</li>
              </ul>
              <Link
                href="/signup"
                className="inline-flex rounded-2xl bg-accent px-4 py-3 font-semibold"
              >
                Start now
              </Link>
            </div>
          </Card>
        </div>
      </Container>
    </main>
  );
}
