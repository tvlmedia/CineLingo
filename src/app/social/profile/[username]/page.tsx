import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function normalizeInstagramUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("@")) return `https://instagram.com/${trimmed.slice(1)}`;
  if (trimmed.includes("instagram.com/")) return `https://${trimmed.replace(/^https?:\/\//, "")}`;
  return `https://instagram.com/${trimmed}`;
}

export default async function SocialProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  await requireUser();
  const supabase = await createClient();
  const { username } = await params;
  const cleanUsername = decodeURIComponent(username || "").trim();

  if (!cleanUsername) {
    notFound();
  }

  let profile:
    | {
        username: string | null;
        full_name: string | null;
        avatar_url: string | null;
        bio: string | null;
        role_focus: string | null;
        experience_level: string | null;
        instagram_url: string | null;
      }
    | null = null;

  const primary = await supabase
    .from("profiles")
    .select("username, full_name, avatar_url, bio, role_focus, experience_level, instagram_url")
    .ilike("username", cleanUsername)
    .maybeSingle();

  if (primary.error && String(primary.error.message || "").toLowerCase().includes("instagram_url")) {
    const fallback = await supabase
      .from("profiles")
      .select("username, full_name, avatar_url, bio, role_focus, experience_level")
      .ilike("username", cleanUsername)
      .maybeSingle();
    profile = fallback.data
      ? {
          ...fallback.data,
          instagram_url: null,
        }
      : null;
  } else {
    profile = primary.data;
  }

  if (!profile) {
    notFound();
  }

  const displayName = profile.full_name || profile.username || "Filmmaker";
  const instagramUrl = profile.instagram_url ? normalizeInstagramUrl(profile.instagram_url) : "";

  return (
    <main className="min-h-screen py-10 md:py-12">
      <div className="mx-auto max-w-3xl px-5 md:px-8">
        <section className="rounded-2xl border border-border bg-[#16171a] p-6 md:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-muted">CineLingo Profile</p>
              <h1 className="mt-1 text-3xl font-semibold">{displayName}</h1>
              <p className="text-sm text-muted">@{profile.username || "unknown"}</p>
            </div>
            <Link
              href="/social"
              className="rounded-xl border border-border bg-[#1a1b1f] px-3 py-2 text-sm font-semibold transition hover:bg-[#22252b]"
            >
              Back to social
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={displayName}
                className="h-20 w-20 rounded-2xl border border-border object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-[#202228] text-2xl font-semibold">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-[#1b1c20] px-3 py-2">
                <p className="text-xs text-muted">Role focus</p>
                <p className="font-semibold">{profile.role_focus || "Not specified"}</p>
              </div>
              <div className="rounded-xl border border-border bg-[#1b1c20] px-3 py-2">
                <p className="text-xs text-muted">Experience level</p>
                <p className="font-semibold">{profile.experience_level || "Not specified"}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-border bg-[#1b1c20] px-4 py-3">
            <p className="text-xs text-muted">Bio</p>
            <p className="mt-1 text-sm text-[#dde0e8]">{profile.bio || "No bio yet."}</p>
          </div>

          {instagramUrl ? (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex rounded-xl border border-border px-3 py-2 text-sm font-semibold transition hover:bg-[#262a33]"
            >
              Open Instagram
            </a>
          ) : null}
        </section>
      </div>
    </main>
  );
}
