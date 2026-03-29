import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  sendFriendRequest,
} from "./actions";
import { Card, Container } from "@/components/ui";

type SocialSearchParams = {
  error?: string;
  sent?: string;
  accepted?: string;
  declined?: string;
  cancelled?: string;
};

function messageFromParams(params: SocialSearchParams): {
  tone: "success" | "error";
  text: string;
} | null {
  if (params.sent) return { tone: "success", text: "Invite sent." };
  if (params.accepted) return { tone: "success", text: "Friend request accepted." };
  if (params.declined) return { tone: "success", text: "Friend request declined." };
  if (params.cancelled) return { tone: "success", text: "Invite cancelled." };

  if (params.error === "missing_username") {
    return { tone: "error", text: "Enter a username first." };
  }
  if (params.error === "user_not_found") {
    return { tone: "error", text: "User not found." };
  }
  if (params.error === "self_add") {
    return { tone: "error", text: "You cannot add yourself." };
  }
  if (params.error === "already_friends") {
    return { tone: "error", text: "You are already friends." };
  }
  if (params.error === "already_sent") {
    return { tone: "error", text: "Invite already sent." };
  }
  if (params.error === "incoming_pending") {
    return { tone: "error", text: "That user already invited you. Accept it below." };
  }
  if (params.error) {
    return { tone: "error", text: "Could not complete that action." };
  }

  return null;
}

export default async function SocialPage({
  searchParams,
}: {
  searchParams?: Promise<SocialSearchParams>;
}) {
  const user = await requireUser();
  const supabase = await createClient();
  const params = (await searchParams) || {};

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, username")
    .eq("id", user.id)
    .single();

  const displayName = profile?.full_name || profile?.username || "Filmmaker";
  const message = messageFromParams(params);

  const [{ data: incomingRequests }, { data: outgoingRequests }, { data: friendshipRows }] =
    await Promise.all([
      supabase
        .from("friend_requests")
        .select("id, sender_id, created_at")
        .eq("receiver_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("friend_requests")
        .select("id, receiver_id, created_at")
        .eq("sender_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("friendships")
        .select("user_a, user_b, created_at")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order("created_at", { ascending: false }),
    ]);

  const relatedProfileIds = new Set<string>();
  (incomingRequests || []).forEach((request) => relatedProfileIds.add(request.sender_id as string));
  (outgoingRequests || []).forEach((request) => relatedProfileIds.add(request.receiver_id as string));
  (friendshipRows || []).forEach((row) => {
    const friendId = (row.user_a === user.id ? row.user_b : row.user_a) as string;
    relatedProfileIds.add(friendId);
  });

  let profilesById = new Map<
    string,
    { username: string; full_name: string | null; avatar_url: string | null }
  >();
  if (relatedProfileIds.size > 0) {
    const { data: relatedProfiles } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .in("id", Array.from(relatedProfileIds));

    profilesById = new Map(
      (relatedProfiles || []).map((entry) => [
        entry.id as string,
        {
          username: String(entry.username || ""),
          full_name: (entry.full_name as string | null) || null,
          avatar_url: (entry.avatar_url as string | null) || null,
        },
      ])
    );
  }

  return (
    <main className="min-h-screen py-10 md:py-14">
      <Container>
        <header className="mb-8 rounded-3xl border border-border bg-card px-4 py-4 shadow-[0_24px_60px_rgba(1,7,18,0.4)] backdrop-blur-sm md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted">CineLingo Social</p>
              <h1 className="text-3xl font-bold md:text-4xl">Hey {displayName}</h1>
            </div>
            <Link
              href="/dashboard"
              className="rounded-2xl border border-border bg-white/5 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/10"
            >
              Back to dashboard
            </Link>
          </div>
        </header>

        {message ? (
          <p
            className={`mb-6 rounded-2xl px-4 py-3 text-sm ${
              message.tone === "success"
                ? "border border-green-500/30 bg-green-500/10 text-green-200"
                : "border border-red-500/30 bg-red-500/10 text-red-200"
            }`}
          >
            {message.text}
          </p>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <h2 className="mb-2 text-2xl font-semibold">Add Friend</h2>
            <p className="mb-4 text-sm text-muted">
              Invite filmmakers by username. You can use `@username` too.
            </p>
            <form action={sendFriendRequest} className="space-y-3">
              <input name="username" placeholder="@username" required />
              <button className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#04231d]">
                Send invite
              </button>
            </form>

            <hr className="my-6 border-border" />

            <h3 className="mb-3 text-lg font-semibold">Incoming Invites</h3>
            <div className="space-y-3">
              {(incomingRequests || []).length === 0 ? (
                <p className="text-sm text-muted">No incoming invites.</p>
              ) : (
                (incomingRequests || []).map((request) => {
                  const sender = profilesById.get(request.sender_id as string);
                  const label = sender?.full_name || sender?.username || "Unknown user";
                  return (
                    <div
                      key={String(request.id)}
                      className="rounded-2xl border border-border bg-white/5 p-3"
                    >
                      <p className="font-semibold">{label}</p>
                      <p className="mb-3 text-xs text-muted">@{sender?.username || "unknown"}</p>
                      <div className="flex gap-2">
                        <form action={acceptFriendRequest}>
                          <input type="hidden" name="requestId" value={String(request.id)} />
                          <button className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-[#04231d]">
                            Accept
                          </button>
                        </form>
                        <form action={declineFriendRequest}>
                          <input type="hidden" name="requestId" value={String(request.id)} />
                          <button className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">
                            Decline
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          <Card>
            <h2 className="mb-2 text-2xl font-semibold">Your Network</h2>
            <p className="mb-4 text-sm text-muted">
              Active invites and accepted friends for future chat and shared learning rooms.
            </p>

            <h3 className="mb-3 text-lg font-semibold">Outgoing Invites</h3>
            <div className="mb-6 space-y-3">
              {(outgoingRequests || []).length === 0 ? (
                <p className="text-sm text-muted">No outgoing invites.</p>
              ) : (
                (outgoingRequests || []).map((request) => {
                  const receiver = profilesById.get(request.receiver_id as string);
                  const label = receiver?.full_name || receiver?.username || "Unknown user";
                  return (
                    <div
                      key={String(request.id)}
                      className="rounded-2xl border border-border bg-white/5 p-3"
                    >
                      <p className="font-semibold">{label}</p>
                      <p className="mb-3 text-xs text-muted">@{receiver?.username || "unknown"}</p>
                      <form action={cancelFriendRequest}>
                        <input type="hidden" name="requestId" value={String(request.id)} />
                        <button className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">
                          Cancel invite
                        </button>
                      </form>
                    </div>
                  );
                })
              )}
            </div>

            <h3 className="mb-3 text-lg font-semibold">Friends</h3>
            <div className="space-y-3">
              {(friendshipRows || []).length === 0 ? (
                <p className="text-sm text-muted">No friends yet.</p>
              ) : (
                (friendshipRows || []).map((row) => {
                  const friendId = (row.user_a === user.id ? row.user_b : row.user_a) as string;
                  const friend = profilesById.get(friendId);
                  const label = friend?.full_name || friend?.username || "Unknown user";

                  return (
                    <div
                      key={`${String(row.user_a)}-${String(row.user_b)}`}
                      className="flex items-center justify-between rounded-2xl border border-border bg-white/5 p-3"
                    >
                      <div>
                        <p className="font-semibold">{label}</p>
                        <p className="text-xs text-muted">@{friend?.username || "unknown"}</p>
                      </div>
                      <button className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted">
                        Chat soon
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      </Container>
    </main>
  );
}
