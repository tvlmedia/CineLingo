import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, Container, Input, TextArea } from "@/components/ui";
import { updateProfile } from "./actions";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; saved?: string }>;
}) {
  const user = await requireUser();
  const supabase = await createClient();
  const params = await searchParams;

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, full_name, bio, role_focus, experience_level")
    .eq("id", user.id)
    .single();

  return (
    <main className="min-h-screen py-16">
      <Container>
        <div className="mx-auto max-w-2xl">
          <Card>
            <h1 className="mb-6 text-3xl font-bold">Your profile</h1>

            {params?.saved ? (
              <p className="mb-4 rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
                Profile saved.
              </p>
            ) : null}

            {params?.error ? (
              <p className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                Saving failed. Try again.
              </p>
            ) : null}

            <form action={updateProfile} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-muted">Username</label>
                <Input name="username" defaultValue={profile?.username || ""} required />
              </div>
              <div>
                <label className="mb-2 block text-sm text-muted">Full name</label>
                <Input name="fullName" defaultValue={profile?.full_name || ""} />
              </div>
              <div>
                <label className="mb-2 block text-sm text-muted">Bio</label>
                <TextArea name="bio" rows={5} defaultValue={profile?.bio || ""} />
              </div>
              <div>
                <label className="mb-2 block text-sm text-muted">Role focus</label>
                <Input name="roleFocus" defaultValue={profile?.role_focus || ""} placeholder="DOP, gaffer, AC, director..." />
              </div>
              <div>
                <label className="mb-2 block text-sm text-muted">Experience level</label>
                <Input name="experienceLevel" defaultValue={profile?.experience_level || ""} placeholder="Beginner, intermediate, advanced..." />
              </div>
              <button className="w-full rounded-2xl bg-accent px-4 py-3 font-semibold">
                Save profile
              </button>
            </form>
          </Card>
        </div>
      </Container>
    </main>
  );
}
