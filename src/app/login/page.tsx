import { Card, Container, Input } from "@/components/ui";
import { login } from "./actions";

export default function LoginPage() {
  return (
    <main className="min-h-screen py-16">
      <Container>
        <div className="mx-auto max-w-xl">
          <Card>
            <h1 className="mb-6 text-3xl font-bold">Log in to CineLingo</h1>
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
