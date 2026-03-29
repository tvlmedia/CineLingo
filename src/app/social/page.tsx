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
import { SocialNetworkClient } from "./SocialNetworkClient";

type SocialSearchParams = {
  error?: string;
  sent?: string;
  accepted?: string;
  declined?: string;
  cancelled?: string;
  sentMessage?: string;
  chat?: string;
};

function messageFromParams(params: SocialSearchParams): {
  tone: "success" | "error";
  text: string;
} | null {
  if (params.sent) return { tone: "success", text: "Invite sent." };
  if (params.accepted) return { tone: "success", text: "Friend request accepted." };
  if (params.declined) return { tone: "success", text: "Friend request declined." };
  if (params.cancelled) return { tone: "success", text: "Invite cancelled." };
  if (params.sentMessage) return { tone: "success", text: "Message sent." };

  if (params.error === "missing_identifier") {
    return { tone: "error", text: "Enter username, e-mail, phone or full name." };
  }
  if (params.error === "user_not_found") {
    return { tone: "error", text: "No user found for that search." };
  }
  if (params.error === "multiple_matches") {
    return { tone: "error", text: "Multiple matches found. Use a more specific search." };
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
  if (params.error === "not_friends") {
    return { tone: "error", text: "You can only chat with accepted friends." };
  }
  if (params.error === "chat_too_long") {
    return { tone: "error", text: "Message is too long." };
  }
  if (params.error === "chat_failed") {
    return { tone: "error", text: "Message could not be sent." };
  }
  if (params.error) {
    return { tone: "error", text: "Could not complete that action." };
  }

  return null;
}

type ProfileLite = {
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  phone: string | null;
};

type ChatMessageRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export default async function SocialPage({
  searchParams,
}: {
  searchParams?: Promise<SocialSearchParams>;
}) {
  const user = await requireUser();
  const supabase = await createClient();
  const params = (await searchParams) || {};
  const selectedChatId = String(params.chat || "").trim();

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

  let profilesById = new Map<string, ProfileLite>();
  if (relatedProfileIds.size > 0) {
    const { data: relatedProfiles } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, email, phone")
      .in("id", Array.from(relatedProfileIds));

    profilesById = new Map(
      (relatedProfiles || []).map((entry) => [
        entry.id as string,
        {
          username: String(entry.username || ""),
          full_name: (entry.full_name as string | null) || null,
          avatar_url: (entry.avatar_url as string | null) || null,
          email: (entry.email as string | null) || null,
          phone: (entry.phone as string | null) || null,
        },
      ])
    );
  }

  const friendIds = (friendshipRows || []).map((row) =>
    (row.user_a === user.id ? row.user_b : row.user_a) as string
  );

  let chatMessages: ChatMessageRow[] = [];

  if (selectedChatId && friendIds.includes(selectedChatId)) {
    const { data } = await supabase
      .from("chat_messages")
      .select("id, sender_id, receiver_id, body, created_at, read_at")
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${selectedChatId}),and(sender_id.eq.${selectedChatId},receiver_id.eq.${user.id})`
      )
      .order("created_at", { ascending: true })
      .limit(120);
    chatMessages = (data || []) as ChatMessageRow[];
  }

  const friends = (friendshipRows || []).map((row) => {
    const friendId = (row.user_a === user.id ? row.user_b : row.user_a) as string;
    const friend = profilesById.get(friendId);
    return {
      id: friendId,
      username: friend?.username || "unknown",
      fullName: friend?.full_name || friend?.username || "Unknown user",
      unreadCount: 0,
    };
  });

  const unreadCounts: Record<string, number> = {};
  if (friends.length > 0) {
    const { data: unreadRows } = await supabase
      .from("chat_messages")
      .select("sender_id")
      .eq("receiver_id", user.id)
      .is("read_at", null);
    (unreadRows || []).forEach((row) => {
      const senderId = row.sender_id as string;
      unreadCounts[senderId] = (unreadCounts[senderId] || 0) + 1;
    });
  }

  const friendsWithUnread = friends.map((friend) => ({
    ...friend,
    unreadCount: unreadCounts[friend.id] || 0,
  }));

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

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-6">
            <Card>
              <h2 className="mb-2 text-2xl font-semibold">Add Friend</h2>
              <p className="mb-4 text-sm text-muted">
                Search by username, full name, e-mail or phone number.
              </p>
              <form action={sendFriendRequest} className="space-y-3">
                <input
                  name="identifier"
                  placeholder="@username, full name, email or +316..."
                  required
                />
                <button className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#04231d]">
                  Send invite
                </button>
              </form>
            </Card>

            <Card>
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
                        <p className="text-xs text-muted">@{sender?.username || "unknown"}</p>
                        <p className="mb-3 text-xs text-muted">
                          {sender?.email || "No email"} {sender?.phone ? `· ${sender.phone}` : ""}
                        </p>
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
              <h3 className="mb-3 text-lg font-semibold">Outgoing Invites</h3>
              <div className="space-y-3">
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
            </Card>
          </div>

          <SocialNetworkClient
            currentUserId={user.id}
            friends={friendsWithUnread}
            initialSelectedChatId={selectedChatId}
            initialMessages={chatMessages}
          />
        </div>
      </Container>
    </main>
  );
}
