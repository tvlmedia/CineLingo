import { Card, Container } from "@/components/ui";

export default function CheckEmailPage() {
  return (
    <main className="min-h-screen py-16">
      <Container>
        <div className="mx-auto max-w-xl">
          <Card>
            <h1 className="mb-4 text-3xl font-bold">Check your email</h1>
            <p className="text-muted">
              Your account was created. Please verify your email address before logging in.
            </p>
          </Card>
        </div>
      </Container>
    </main>
  );
}
