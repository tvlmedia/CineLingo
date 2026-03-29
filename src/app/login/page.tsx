import { Card, Container, Input } from "@/components/ui";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = params?.error;

  return (
    <main className="min-h-screen py-16">
      <Container>
        <div className="mx-auto max-w-xl">
          <Card>
            <h1 className="mb-6 text-3xl font-bold">Log in to CineLingo</h1>
            {error ? (
              <p className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                Login failed. Check your details and try again.
              </p>
            ) : null}
            <form action={login} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-muted">Email</label>
                <Input name="email" type="email" required />
              </div>
              <div>
                <label className="mb-2 block text-sm text-muted">Password</label>
                <Input name="password" type="password" required />
              </div>
              <button className="w-full rounded-2xl bg-accent px-4 py-3 font-semibold">
                Log in
              </button>
            </form>
          </Card>
        </div>
      </Container>
    </main>
  );
}
