import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { splitPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { Card, Container } from "@/components/ui";
import { ProfileForm } from "./ProfileForm";
import { updateProfile } from "./actions";

type ProfileRow = {
  username: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  instagram_url: string | null;
  bio: string | null;
  role_focus: string | null;
  experience_level: string | null;
};

function isMissingInstagramColumn(errorMessage: string | undefined): boolean {
  return String(errorMessage || "").toLowerCase().includes("instagram_url");
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; saved?: string; warn?: string }>;
}) {
  const user = await requireUser();
  const supabase = await createClient();
  const params = await searchParams;

  let { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("username, full_name, phone, avatar_url, instagram_url, bio, role_focus, experience_level")
    .eq("id", user.id)
    .single<ProfileRow>();

  if (profileError && isMissingInstagramColumn(profileError.message)) {
    const fallback = await supabase
      .from("profiles")
      .select("username, full_name, phone, avatar_url, bio, role_focus, experience_level")
      .eq("id", user.id)
      .single<
        Pick<
          ProfileRow,
          "username" | "full_name" | "phone" | "avatar_url" | "bio" | "role_focus" | "experience_level"
        >
      >();

    profile = fallback.data
      ? {
          ...fallback.data,
          instagram_url: "",
        }
      : null;
    profileError = fallback.error;
  }

  if (profileError || !profile) {
    return (
      <main className="min-h-screen py-16">
        <Container>
          <div className="mx-auto max-w-2xl">
            <Card>
              <div className="mb-6">
                <Link
                  href="/dashboard"
                  className="inline-flex rounded-xl border border-border bg-[#1a1b1f] px-3 py-2 text-sm text-muted transition hover:bg-[#22252b]"
                >
                  Back to dashboard
                </Link>
              </div>
              <h1 className="mb-3 text-3xl font-semibold">Profile Studio</h1>
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                We could not load your profile safely. No fields were changed.
              </p>
            </Card>
          </div>
        </Container>
      </main>
    );
  }

  const phoneFields = splitPhone(profile.phone);
  const fallbackUsername =
    profile.username ||
    String((user.user_metadata as { username?: string } | null)?.username || "").trim() ||
    (user.email ? user.email.split("@")[0] : "");

  const displayName = profile.full_name || fallbackUsername;

  return (
    <main className="min-h-screen py-8 md:py-10">
      <Container>
        <header className="mb-7 rounded-2xl border border-border bg-[#151619] px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Profile Studio</p>
              <h1 className="mt-1 text-3xl font-semibold md:text-4xl">Creative Identity</h1>
            </div>
            <Link
              href="/dashboard"
              className="rounded-xl border border-border bg-[#1a1b1f] px-3 py-2 text-sm font-semibold transition hover:bg-[#22252b]"
            >
              Back to dashboard
            </Link>
          </div>
        </header>

        {params?.saved ? (
          <p className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            Profile saved.
          </p>
        ) : null}

        {params?.warn === "avatar_upload_failed" ? (
          <p className="mb-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
            Profile saved, but photo upload failed. Check Supabase avatar bucket/policies.
          </p>
        ) : null}

        {params?.error === "invalid_instagram" ? (
          <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            Invalid Instagram link. Use @username or instagram.com/username.
          </p>
        ) : null}

        {params?.error && params.error !== "invalid_instagram" ? (
          <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            Saving failed. Try again.
          </p>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[0.85fr_1.4fr]">
          <aside className="space-y-6">
            <div className="rounded-2xl border border-border bg-[#16171a] p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Preview</p>
              <div className="mt-4 flex items-center gap-4">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Profile"
                    className="h-20 w-20 rounded-xl border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-border bg-[#1d1f24] text-2xl font-semibold">
                    {displayName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-xl font-semibold">{displayName}</p>
                  <p className="text-sm text-muted">@{fallbackUsername}</p>
                </div>
              </div>

              <div className="mt-5 space-y-3 rounded-xl border border-border bg-[#1b1c20] p-4">
                <div>
                  <p className="text-xs text-muted">Role focus</p>
                  <p className="font-medium">{profile.role_focus || "Not set"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Experience level</p>
                  <p className="font-medium">{profile.experience_level || "Not set"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Instagram</p>
                  <p className="truncate font-medium">{profile.instagram_url || "Not linked"}</p>
                </div>
              </div>

              <p className="mt-4 text-sm text-muted">
                {profile.bio || "Add a short description of your visual style and set experience."}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-[#16171a] p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Quick links</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/onboarding" className="rounded-xl border border-border bg-[#1a1b1f] px-3 py-2 text-sm font-semibold transition hover:bg-[#22252b]">
                  Assessment
                </Link>
                <Link href="/social" className="rounded-xl border border-border bg-[#1a1b1f] px-3 py-2 text-sm font-semibold transition hover:bg-[#22252b]">
                  Social
                </Link>
              </div>
            </div>
          </aside>

          <div className="rounded-2xl border border-border bg-[#16171a] p-6 md:p-7">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Editable profile</p>
            <h2 className="mt-2 text-3xl font-semibold">Public profile settings</h2>
            <p className="mt-2 text-sm text-muted">
              Keep your profile clear and credible so collaborators can quickly understand your craft focus.
            </p>

            <div className="mt-6">
              <ProfileForm
                action={updateProfile}
                profile={{
                  username: fallbackUsername,
                  fullName: profile.full_name || "",
                  phoneCountryCode: phoneFields.countryCode,
                  phoneNationalNumber: phoneFields.nationalNumber,
                  avatarUrl: profile.avatar_url || "",
                  instagramUrl: profile.instagram_url || "",
                  bio: profile.bio || "",
                  roleFocus: profile.role_focus || "",
                  experienceLevel: profile.experience_level || "",
                }}
              />
            </div>
          </div>
        </section>
      </Container>
    </main>
  );
}
