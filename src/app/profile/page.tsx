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
      .single<Pick<ProfileRow, "username" | "full_name" | "phone" | "avatar_url" | "bio" | "role_focus" | "experience_level">>();

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
                  Back to main menu
                </Link>
              </div>
              <h1 className="mb-3 text-3xl font-bold">Your profile</h1>
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
                Back to main menu
              </Link>
            </div>
            <h1 className="mb-6 text-3xl font-bold">Your profile</h1>

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
          </Card>
        </div>
      </Container>
    </main>
  );
}
