import { Card, Container, Input } from "@/components/ui";
import { signUp } from "./actions";

export default async function SignupPage({
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
            <h1 className="mb-6 text-3xl font-bold">Create your CineLingo account</h1>

            {error ? (
              <p className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                Signup failed. Try again with a different email, username or phone number.
              </p>
            ) : null}

            <form action={signUp} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-muted">Username</label>
                <Input name="username" required />
              </div>

              <div>
                <label className="mb-2 block text-sm text-muted">Full name</label>
                <Input name="fullName" />
              </div>

              <div>
                <label className="mb-2 block text-sm text-muted">Phone number</label>
                <Input name="phone" type="tel" required />
              </div>

              <div>
                <label className="mb-2 block text-sm text-muted">Email</label>
                <Input name="email" type="email" required />
              </div>

              <div>
                <label className="mb-2 block text-sm text-muted">Password</label>
                <Input name="password" type="password" required />
              </div>

              <button className="w-full rounded-2xl bg-accent px-4 py-3 font-semibold">
                Sign up
              </button>
            </form>
          </Card>
        </div>
      </Container>
    </main>
  );
}
