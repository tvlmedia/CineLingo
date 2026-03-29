import { Card, Container, Input } from "@/components/ui";
import { signUp } from "./actions";

export default function SignupPage() {
  return (
    <main className="min-h-screen py-16">
      <Container>
        <div className="mx-auto max-w-xl">
          <Card>
            <h1 className="mb-6 text-3xl font-bold">Create your CineLingo account</h1>
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
