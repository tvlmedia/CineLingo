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
        <section className="rounded-[30px] border border-[#294067]/45 bg-[linear-gradient(160deg,rgba(8,19,43,0.94),rgba(7,16,35,0.92))] p-6 shadow-[0_26px_80px_rgba(1,7,18,0.6)] md:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#8fa9d2]">CineLingo Profile</p>
              <h1 className="mt-1 text-3xl font-bold">{displayName}</h1>
              <p className="text-sm text-[#9fb5da]">@{profile.username || "unknown"}</p>
            </div>
            <Link
              href="/social"
              className="rounded-xl border border-border bg-white/5 px-3 py-2 text-sm font-semibold transition hover:bg-white/10"
            >
              Back to social
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={displayName}
                className="h-20 w-20 rounded-2xl border border-[#35527f] object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[#35527f] bg-[#0d1e40] text-2xl font-semibold">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-[#2a436d] bg-[#102346] px-3 py-2">
                <p className="text-xs text-[#9fb5da]">Role focus</p>
                <p className="font-semibold">{profile.role_focus || "Not specified"}</p>
              </div>
              <div className="rounded-xl border border-[#2a436d] bg-[#102346] px-3 py-2">
                <p className="text-xs text-[#9fb5da]">Experience level</p>
                <p className="font-semibold">{profile.experience_level || "Not specified"}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-[#2a436d] bg-[#102346] px-4 py-3">
            <p className="text-xs text-[#9fb5da]">Bio</p>
            <p className="mt-1 text-sm text-[#d4e4ff]">{profile.bio || "No bio yet."}</p>
          </div>

          {instagramUrl ? (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex rounded-xl border border-[#35527f] px-3 py-2 text-sm font-semibold transition hover:bg-[#12264d]"
            >
              Open Instagram
            </a>
          ) : null}
        </section>
      </div>
    </main>
  );
}
