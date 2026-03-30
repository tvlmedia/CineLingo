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
                  className="inline-flex rounded-xl border border-border px-3 py-2 text-sm text-muted transition hover:bg-white/5"
                >
                  Back to dashboard
                </Link>
              </div>
              <h1 className="mb-3 text-3xl font-bold">Profile Studio</h1>
              <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
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
    <main className="min-h-screen py-10 md:py-12">
      <Container>
        <header className="mb-6 rounded-[30px] border border-[#2a3f66]/50 bg-[linear-gradient(150deg,rgba(8,20,46,0.96),rgba(6,17,38,0.92))] px-5 py-4 shadow-[0_30px_80px_rgba(2,6,18,0.55)] md:px-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#92a9d0]">Profile Studio</p>
              <h1 className="text-3xl font-bold md:text-4xl">Identity & Presence</h1>
            </div>
            <Link
              href="/dashboard"
              className="rounded-xl border border-border bg-white/5 px-3 py-2 text-sm font-semibold transition hover:bg-white/10"
            >
              Back to dashboard
            </Link>
          </div>
        </header>

        {params?.saved ? (
          <p className="mb-4 rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
            Profile saved.
          </p>
        ) : null}

        {params?.warn === "avatar_upload_failed" ? (
          <p className="mb-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
            Profile saved, but photo upload failed. Check Supabase avatar bucket/policies.
          </p>
        ) : null}

        {params?.error === "invalid_instagram" ? (
          <p className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            Invalid Instagram link. Use @username or instagram.com/username.
          </p>
        ) : null}

        {params?.error && params.error !== "invalid_instagram" ? (
          <p className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            Saving failed. Try again.
          </p>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[0.85fr_1.4fr]">
          <aside className="space-y-6">
            <div className="rounded-[28px] border border-[#294067]/45 bg-[linear-gradient(160deg,rgba(7,17,39,0.94),rgba(8,18,37,0.92))] p-6 shadow-[0_24px_70px_rgba(1,7,18,0.56)]">
              <p className="text-xs uppercase tracking-[0.22em] text-[#8fa9d2]">Profile Preview</p>
              <div className="mt-4 flex items-center gap-4">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Profile"
                    className="h-20 w-20 rounded-2xl border border-[#35527f] object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[#35527f] bg-[#0f1f42] text-2xl font-semibold">
                    {displayName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-xl font-semibold">{displayName}</p>
                  <p className="text-sm text-[#9fb5da]">@{fallbackUsername}</p>
                </div>
              </div>

              <div className="mt-5 space-y-3 rounded-2xl border border-[#2a436d] bg-[#0f1f42] p-4">
                <div>
                  <p className="text-xs text-[#9fb5da]">Role Focus</p>
                  <p className="font-medium">{profile.role_focus || "Not set"}</p>
                </div>
                <div>
                  <p className="text-xs text-[#9fb5da]">Experience Level</p>
                  <p className="font-medium">{profile.experience_level || "Not set"}</p>
                </div>
                <div>
                  <p className="text-xs text-[#9fb5da]">Instagram</p>
                  <p className="truncate font-medium">{profile.instagram_url || "Not linked"}</p>
                </div>
              </div>

              <p className="mt-4 text-sm text-[#b3c5e5]">
                {profile.bio || "Add a short description of your visual style and set experience."}
              </p>
            </div>

            <div className="rounded-[28px] border border-[#294067]/45 bg-[linear-gradient(160deg,rgba(7,17,39,0.94),rgba(8,18,37,0.92))] p-6 shadow-[0_24px_70px_rgba(1,7,18,0.56)]">
              <p className="text-xs uppercase tracking-[0.22em] text-[#8fa9d2]">Quick Links</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/onboarding" className="rounded-xl border border-[#365684] px-3 py-2 text-sm font-semibold transition hover:bg-[#12264d]">
                  Assessment
                </Link>
                <Link href="/social" className="rounded-xl border border-[#365684] px-3 py-2 text-sm font-semibold transition hover:bg-[#12264d]">
                  Social
                </Link>
              </div>
            </div>
          </aside>

          <div className="rounded-[30px] border border-[#294067]/45 bg-[linear-gradient(160deg,rgba(8,19,43,0.94),rgba(7,16,35,0.92))] p-6 shadow-[0_26px_80px_rgba(1,7,18,0.6)] md:p-7">
            <p className="text-xs uppercase tracking-[0.22em] text-[#8fa9d2]">Editable Profile</p>
            <h2 className="mt-2 text-3xl font-semibold">Public identity settings</h2>
            <p className="mt-2 text-sm text-[#aec2e2]">
              Keep your profile clear and professional so collaborators can quickly understand your craft focus.
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
