import { Card, Container, Input } from "@/components/ui";
import { PHONE_COUNTRY_CODES } from "@/lib/phone";
import { signUp } from "./actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = params?.error;
  const errorMessage =
    error === "missing_fields"
      ? "Vul alle velden in."
      : error === "invalid_phone"
        ? "Voer een geldig telefoonnummer in met landcode."
        : error === "email_taken"
          ? "Dit e-mailadres is al in gebruik."
          : error === "username_taken"
            ? "Deze username is al bezet. Kies een andere."
            : error === "weak_password"
              ? "Kies een sterker wachtwoord (minimaal 6 tekens)."
              : error === "signup_conflict"
                ? "Er is al een account met deze gegevens. Probeer een andere username of e-mail."
                : error
                  ? "Signup failed. Try again with a different email, username or phone number."
                  : null;

  return (
    <main className="min-h-screen py-16">
      <Container>
        <div className="mx-auto max-w-xl">
          <Card>
            <h1 className="mb-6 text-3xl font-bold">Create your CineLingo account</h1>

            {errorMessage ? (
              <p className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {errorMessage}
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[220px_1fr]">
                  <select name="phoneCountryCode" defaultValue="+31" required>
                    {PHONE_COUNTRY_CODES.map((entry) => (
                      <option key={entry.value} value={entry.value}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    name="phoneNationalNumber"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="6 12345678"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-muted">Email</label>
                <Input name="email" type="email" required />
              </div>

              <div>
                <label className="mb-2 block text-sm text-muted">Password</label>
                <Input name="password" type="password" minLength={6} required />
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
