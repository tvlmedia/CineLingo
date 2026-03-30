import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  sendFriendRequest,
} from "./actions";
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

type ProfileSocial = {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  bio: string | null;
  roleFocus: string | null;
  experienceLevel: string | null;
  instagramUrl: string | null;
  email: string | null;
  phone: string | null;
};

type AssessmentAttemptLite = {
  id: string;
  user_id: string;
  total_correct: number;
  total_questions: number;
  completed_at: string | null;
};

type AssessmentScoreLite = {
  attempt_id: string;
  category: string;
  correct_count: number;
  question_count: number;
  score_band: string;
};

type FriendSummary = {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  roleFocus: string;
  levelLabel: string;
  strongest: string[];
  unreadCount: number;
};

type ProfilePanelData = {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  bio: string;
  roleFocus: string;
  experienceLevel: string;
  levelLabel: string;
  strongest: string[];
  instagramUrl: string | null;
  mutualFriends: Array<{ id: string; fullName: string; username: string; avatarUrl: string | null }>;
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

function isMissingInstagramColumn(errorMessage: string | undefined): boolean {
  return String(errorMessage || "").toLowerCase().includes("instagram_url");
}

function computeLevelLabel(attempt: AssessmentAttemptLite | undefined, fallbackExperience: string | null): string {
  if (!attempt || !attempt.total_questions) {
    return fallbackExperience?.trim() || "Unrated";
  }

  const ratio = (attempt.total_correct / attempt.total_questions) * 100;
  if (ratio >= 85) return "Expert";
  if (ratio >= 70) return "Advanced";
  if (ratio >= 55) return "Intermediate";
  if (ratio >= 35) return "Developing";
  return "Foundation";
}

function strongestDisciplines(rows: AssessmentScoreLite[]): string[] {
  if (rows.length === 0) return [];

  let bestRatio = -1;
  for (const row of rows) {
    const ratio = row.question_count > 0 ? row.correct_count / row.question_count : 0;
    if (ratio > bestRatio) bestRatio = ratio;
  }

  const strongest = rows
    .filter((row) => {
      const ratio = row.question_count > 0 ? row.correct_count / row.question_count : 0;
      return ratio === bestRatio;
    })
    .map((row) => row.category)
    .sort((a, b) => a.localeCompare(b));

  return strongest.slice(0, 3);
}

export default async function SocialPage({
  searchParams,
}: {
  searchParams?: Promise<SocialSearchParams>;
}) {
  const user = await requireUser();
  const supabase = await createClient();
  const params = (await searchParams) || {};
  const selectedChatId = String(params.chat || "").trim();

  const message = messageFromParams(params);

  const [{ data: selfProfile }, { data: incomingRequests }, { data: outgoingRequests }, { data: friendshipRows }] =
    await Promise.all([
      supabase.from("profiles").select("full_name, username").eq("id", user.id).single(),
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

  const displayName = selfProfile?.full_name || selfProfile?.username || "Filmmaker";

  const friendIds = (friendshipRows || []).map((row) =>
    (row.user_a === user.id ? row.user_b : row.user_a) as string
  );

  const relatedProfileIds = new Set<string>(friendIds);
  (incomingRequests || []).forEach((request) => relatedProfileIds.add(String(request.sender_id)));
  (outgoingRequests || []).forEach((request) => relatedProfileIds.add(String(request.receiver_id)));

  let relatedProfilesData:
    | Array<{
        id: string;
        username: string | null;
        full_name: string | null;
        avatar_url: string | null;
        bio: string | null;
        role_focus: string | null;
        experience_level: string | null;
        instagram_url: string | null;
        email: string | null;
        phone: string | null;
      }>
    | null = null;

  if (relatedProfileIds.size > 0) {
    const primary = await supabase
      .from("profiles")
      .select(
        "id, username, full_name, avatar_url, bio, role_focus, experience_level, instagram_url, email, phone"
      )
      .in("id", Array.from(relatedProfileIds));

    if (primary.error && isMissingInstagramColumn(primary.error.message)) {
      const fallback = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, bio, role_focus, experience_level, email, phone")
        .in("id", Array.from(relatedProfileIds));

      relatedProfilesData = (fallback.data || []).map((row) => ({
        ...row,
        instagram_url: null,
      }));
    } else {
      relatedProfilesData = primary.data || [];
    }
  }

  const profilesById = new Map<string, ProfileSocial>();
  (relatedProfilesData || []).forEach((entry) => {
    profilesById.set(String(entry.id), {
      id: String(entry.id),
      username: String(entry.username || "unknown"),
      fullName: String(entry.full_name || entry.username || "Unknown user"),
      avatarUrl: entry.avatar_url,
      bio: entry.bio,
      roleFocus: entry.role_focus,
      experienceLevel: entry.experience_level,
      instagramUrl: entry.instagram_url,
      email: entry.email,
      phone: entry.phone,
    });
  });

  const { data: unreadRows } = await supabase
    .from("chat_messages")
    .select("sender_id")
    .eq("receiver_id", user.id)
    .is("read_at", null);

  const unreadByFriend: Record<string, number> = {};
  (unreadRows || []).forEach((row) => {
    const senderId = String(row.sender_id || "");
    if (!senderId) return;
    unreadByFriend[senderId] = (unreadByFriend[senderId] || 0) + 1;
  });

  const { data: attemptsRows } = friendIds.length
    ? await supabase
        .from("assessment_attempts")
        .select("id, user_id, total_correct, total_questions, completed_at")
        .in("user_id", friendIds)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
    : { data: [] as AssessmentAttemptLite[] };

  const latestAttemptByUser = new Map<string, AssessmentAttemptLite>();
  (attemptsRows || []).forEach((row) => {
    const userId = String(row.user_id);
    if (!latestAttemptByUser.has(userId)) {
      latestAttemptByUser.set(userId, {
        id: String(row.id),
        user_id: userId,
        total_correct: Number(row.total_correct || 0),
        total_questions: Number(row.total_questions || 0),
        completed_at: row.completed_at ? String(row.completed_at) : null,
      });
    }
  });

  const latestAttemptIds = Array.from(latestAttemptByUser.values()).map((row) => row.id);

  const { data: scoreRows } = latestAttemptIds.length
    ? await supabase
        .from("user_assessment_scores")
        .select("attempt_id, category, correct_count, question_count, score_band")
        .in("attempt_id", latestAttemptIds)
    : { data: [] as AssessmentScoreLite[] };

  const scoresByAttempt = new Map<string, AssessmentScoreLite[]>();
  (scoreRows || []).forEach((row) => {
    const key = String(row.attempt_id);
    const list = scoresByAttempt.get(key) || [];
    list.push({
      attempt_id: key,
      category: String(row.category || ""),
      correct_count: Number(row.correct_count || 0),
      question_count: Number(row.question_count || 0),
      score_band: String(row.score_band || ""),
    });
    scoresByAttempt.set(key, list);
  });

  const friendSummaries: FriendSummary[] = friendIds
    .map((friendId) => {
      const profile = profilesById.get(friendId);
      if (!profile) return null;

      const latestAttempt = latestAttemptByUser.get(friendId);
      const levelLabel = computeLevelLabel(latestAttempt, profile.experienceLevel);
      const strongest = latestAttempt ? strongestDisciplines(scoresByAttempt.get(latestAttempt.id) || []) : [];

      return {
        id: friendId,
        username: profile.username,
        fullName: profile.fullName,
        avatarUrl: profile.avatarUrl,
        roleFocus: profile.roleFocus || "Role not set",
        levelLabel,
        strongest,
        unreadCount: unreadByFriend[friendId] || 0,
      };
    })
    .filter((entry): entry is FriendSummary => entry !== null)
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const activeFriendId =
    selectedChatId && friendSummaries.some((friend) => friend.id === selectedChatId)
      ? selectedChatId
      : friendSummaries[0]?.id || "";

  const selectedFriendSummary = friendSummaries.find((friend) => friend.id === activeFriendId) || null;

  let chatMessages: Array<{
    id: string;
    sender_id: string;
    receiver_id: string;
    body: string;
    created_at: string;
    read_at: string | null;
  }> = [];

  if (selectedFriendSummary) {
    const { data } = await supabase
      .from("chat_messages")
      .select("id, sender_id, receiver_id, body, created_at, read_at")
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${selectedFriendSummary.id}),and(sender_id.eq.${selectedFriendSummary.id},receiver_id.eq.${user.id})`
      )
      .order("created_at", { ascending: true })
      .limit(160);
    chatMessages = (data || []).map((row) => ({
      id: String(row.id),
      sender_id: String(row.sender_id),
      receiver_id: String(row.receiver_id),
      body: String(row.body),
      created_at: String(row.created_at),
      read_at: row.read_at ? String(row.read_at) : null,
    }));
  }

  const incomingCards = (incomingRequests || []).map((request) => {
    const sender = profilesById.get(String(request.sender_id));
    return {
      requestId: String(request.id),
      id: String(request.sender_id),
      fullName: sender?.fullName || "Unknown user",
      username: sender?.username || "unknown",
      avatarUrl: sender?.avatarUrl || null,
      roleFocus: sender?.roleFocus || "Role not set",
      email: sender?.email || null,
      phone: sender?.phone || null,
    };
  });

  const outgoingCards = (outgoingRequests || []).map((request) => {
    const receiver = profilesById.get(String(request.receiver_id));
    return {
      requestId: String(request.id),
      id: String(request.receiver_id),
      fullName: receiver?.fullName || "Unknown user",
      username: receiver?.username || "unknown",
      avatarUrl: receiver?.avatarUrl || null,
      roleFocus: receiver?.roleFocus || "Role not set",
    };
  });

  let profilePanel: ProfilePanelData | null = null;

  if (selectedFriendSummary) {
    const selectedProfile = profilesById.get(selectedFriendSummary.id);

    const { data: selectedFriendships } = await supabase
      .from("friendships")
      .select("user_a, user_b")
      .or(`user_a.eq.${selectedFriendSummary.id},user_b.eq.${selectedFriendSummary.id}`);

    const selectedConnections = new Set<string>();
    (selectedFriendships || []).forEach((row) => {
      const a = String(row.user_a);
      const b = String(row.user_b);
      selectedConnections.add(a === selectedFriendSummary.id ? b : a);
    });

    const mutualIds = friendSummaries
      .map((friend) => friend.id)
      .filter((friendId) => friendId !== selectedFriendSummary.id && selectedConnections.has(friendId));

    const mutualFriends = mutualIds
      .map((id) => {
        const profile = profilesById.get(id);
        if (!profile) return null;
        return {
          id,
          fullName: profile.fullName,
          username: profile.username,
          avatarUrl: profile.avatarUrl,
        };
      })
      .filter(
        (entry): entry is { id: string; fullName: string; username: string; avatarUrl: string | null } =>
          entry !== null
      )
      .slice(0, 6);

    profilePanel = {
      id: selectedFriendSummary.id,
      username: selectedFriendSummary.username,
      fullName: selectedFriendSummary.fullName,
      avatarUrl: selectedFriendSummary.avatarUrl,
      bio: selectedProfile?.bio || "No bio yet.",
      roleFocus: selectedProfile?.roleFocus || "Not specified",
      experienceLevel: selectedProfile?.experienceLevel || "Not specified",
      levelLabel: selectedFriendSummary.levelLabel,
      strongest: selectedFriendSummary.strongest,
      instagramUrl: selectedProfile?.instagramUrl || null,
      mutualFriends,
    };
  }

  return (
    <main className="min-h-screen py-8 md:py-12">
      <div className="mx-auto max-w-[1480px] px-5 md:px-8">
        <header className="mb-8 rounded-[30px] border border-[#2a3f66]/50 bg-[linear-gradient(150deg,rgba(8,20,46,0.96),rgba(6,17,38,0.92))] px-5 py-4 shadow-[0_30px_80px_rgba(2,6,18,0.55)] md:px-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#92a9d0]">CineLingo Network</p>
              <h1 className="text-3xl font-bold md:text-4xl">Filmmaker Social Layer</h1>
              <p className="mt-2 text-sm text-[#afc4e6]">
                Connect with cinematographers by craft profile, strengths, and collaboration relevance.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard"
                className="rounded-xl border border-border bg-white/5 px-3 py-2 text-sm font-semibold transition hover:bg-white/10"
              >
                Back to dashboard
              </Link>
            </div>
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

        <section className="grid gap-6 xl:grid-cols-[380px_1fr_360px]">
          <aside className="space-y-5">
            <section className="rounded-[28px] border border-[#294067]/45 bg-[linear-gradient(160deg,rgba(8,19,43,0.94),rgba(7,16,35,0.92))] p-5 shadow-[0_24px_70px_rgba(1,7,18,0.56)]">
              <h2 className="text-xl font-semibold">Add filmmaker</h2>
              <p className="mt-1 text-sm text-[#a9bfdf]">
                Search by username, full name, e-mail or phone number.
              </p>
              <form action={sendFriendRequest} className="mt-4 space-y-3">
                <input
                  name="identifier"
                  placeholder="@username, full name, email or +316..."
                  required
                />
                <button className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#04231d]">
                  Send invite
                </button>
              </form>
            </section>

            <section className="rounded-[28px] border border-[#294067]/45 bg-[linear-gradient(160deg,rgba(8,19,43,0.94),rgba(7,16,35,0.92))] p-5 shadow-[0_24px_70px_rgba(1,7,18,0.56)]">
              <h3 className="text-lg font-semibold">Incoming invites</h3>
              <div className="mt-3 space-y-3">
                {incomingCards.length === 0 ? (
                  <p className="text-sm text-[#9fb5da]">No incoming invites.</p>
                ) : (
                  incomingCards.map((entry) => (
                    <div key={entry.requestId} className="rounded-2xl border border-[#2a436d] bg-[#102346] p-3">
                      <div className="flex items-center gap-3">
                        {entry.avatarUrl ? (
                          <img
                            src={entry.avatarUrl}
                            alt={entry.fullName}
                            className="h-10 w-10 rounded-xl border border-[#35527f] object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#35527f] bg-[#0d1e40] text-sm font-semibold">
                            {entry.fullName.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold">{entry.fullName}</p>
                          <p className="text-xs text-[#9fb5da]">@{entry.username}</p>
                          <p className="text-xs text-[#89a5d3]">{entry.roleFocus}</p>
                        </div>
                      </div>

                      <p className="mt-2 text-[11px] text-[#88a3cf]">
                        {entry.email || "No email"} {entry.phone ? `· ${entry.phone}` : ""}
                      </p>

                      <div className="mt-3 flex gap-2">
                        <form action={acceptFriendRequest}>
                          <input type="hidden" name="requestId" value={entry.requestId} />
                          <button className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-[#04231d]">
                            Accept
                          </button>
                        </form>
                        <form action={declineFriendRequest}>
                          <input type="hidden" name="requestId" value={entry.requestId} />
                          <button className="rounded-lg border border-[#35527f] px-3 py-2 text-xs font-semibold">
                            Decline
                          </button>
                        </form>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-[#294067]/45 bg-[linear-gradient(160deg,rgba(8,19,43,0.94),rgba(7,16,35,0.92))] p-5 shadow-[0_24px_70px_rgba(1,7,18,0.56)]">
              <h3 className="text-lg font-semibold">Outgoing invites</h3>
              <div className="mt-3 space-y-3">
                {outgoingCards.length === 0 ? (
                  <p className="text-sm text-[#9fb5da]">No outgoing invites.</p>
                ) : (
                  outgoingCards.map((entry) => (
                    <div key={entry.requestId} className="rounded-2xl border border-[#2a436d] bg-[#102346] p-3">
                      <div className="flex items-center gap-3">
                        {entry.avatarUrl ? (
                          <img
                            src={entry.avatarUrl}
                            alt={entry.fullName}
                            className="h-10 w-10 rounded-xl border border-[#35527f] object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#35527f] bg-[#0d1e40] text-sm font-semibold">
                            {entry.fullName.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold">{entry.fullName}</p>
                          <p className="text-xs text-[#9fb5da]">@{entry.username}</p>
                          <p className="text-xs text-[#89a5d3]">{entry.roleFocus}</p>
                        </div>
                      </div>
                      <form action={cancelFriendRequest} className="mt-3">
                        <input type="hidden" name="requestId" value={entry.requestId} />
                        <button className="rounded-lg border border-[#35527f] px-3 py-2 text-xs font-semibold">
                          Cancel invite
                        </button>
                      </form>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-[#294067]/45 bg-[linear-gradient(160deg,rgba(8,19,43,0.94),rgba(7,16,35,0.92))] p-5 shadow-[0_24px_70px_rgba(1,7,18,0.56)]">
              <h3 className="text-lg font-semibold">Friends ({friendSummaries.length})</h3>
              <div className="mt-3 space-y-3">
                {friendSummaries.length === 0 ? (
                  <p className="text-sm text-[#9fb5da]">No friends yet.</p>
                ) : (
                  friendSummaries.map((friend) => {
                    const isActive = friend.id === activeFriendId;
                    return (
                      <Link
                        key={friend.id}
                        href={`/social?chat=${friend.id}`}
                        className={`block rounded-2xl border p-3 transition ${
                          isActive
                            ? "border-accent bg-[#153058]"
                            : "border-[#2a436d] bg-[#102346] hover:border-[#466699] hover:bg-[#13305b]"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {friend.avatarUrl ? (
                            <img
                              src={friend.avatarUrl}
                              alt={friend.fullName}
                              className="h-12 w-12 rounded-xl border border-[#35527f] object-cover"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#35527f] bg-[#0d1e40] text-sm font-semibold">
                              {friend.fullName.slice(0, 1).toUpperCase()}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="truncate font-semibold">{friend.fullName}</p>
                              <span className="rounded-full border border-[#395984] bg-[#0f2446] px-2 py-0.5 text-[10px] font-semibold text-[#d2e3ff]">
                                {friend.levelLabel}
                              </span>
                            </div>
                            <p className="truncate text-xs text-[#9fb5da]">@{friend.username}</p>
                            <p className="truncate text-xs text-[#89a5d3]">{friend.roleFocus}</p>
                            {friend.strongest.length > 0 ? (
                              <p className="mt-1 truncate text-[11px] text-[#7cd9be]">
                                Strongest: {friend.strongest.join(", ")}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        {friend.unreadCount > 0 ? (
                          <p className="mt-2 text-xs font-semibold text-accent">
                            {friend.unreadCount} unread message{friend.unreadCount > 1 ? "s" : ""}
                          </p>
                        ) : null}
                      </Link>
                    );
                  })
                )}
              </div>
            </section>
          </aside>

          <SocialNetworkClient
            currentUserId={user.id}
            selectedFriend={
              selectedFriendSummary
                ? {
                    id: selectedFriendSummary.id,
                    fullName: selectedFriendSummary.fullName,
                    username: selectedFriendSummary.username,
                    avatarUrl: selectedFriendSummary.avatarUrl,
                    levelLabel: selectedFriendSummary.levelLabel,
                  }
                : null
            }
            initialMessages={chatMessages}
          />

          <aside className="space-y-5">
            <section className="rounded-[28px] border border-[#294067]/45 bg-[linear-gradient(160deg,rgba(8,19,43,0.94),rgba(7,16,35,0.92))] p-5 shadow-[0_24px_70px_rgba(1,7,18,0.56)]">
              <h2 className="text-xl font-semibold">Filmmaker profile</h2>
              {!profilePanel ? (
                <p className="mt-3 text-sm text-[#9fb5da]">
                  Select a friend to view their cinematography profile context.
                </p>
              ) : (
                <>
                  <div className="mt-4 flex items-center gap-3">
                    {profilePanel.avatarUrl ? (
                      <img
                        src={profilePanel.avatarUrl}
                        alt={profilePanel.fullName}
                        className="h-16 w-16 rounded-2xl border border-[#35527f] object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#35527f] bg-[#0d1e40] text-lg font-semibold">
                        {profilePanel.fullName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-lg font-semibold">{profilePanel.fullName}</p>
                      <p className="text-sm text-[#9fb5da]">@{profilePanel.username}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2">
                    <div className="rounded-xl border border-[#2a436d] bg-[#102346] px-3 py-2">
                      <p className="text-xs text-[#9fb5da]">Current level</p>
                      <p className="font-semibold">{profilePanel.levelLabel}</p>
                    </div>
                    <div className="rounded-xl border border-[#2a436d] bg-[#102346] px-3 py-2">
                      <p className="text-xs text-[#9fb5da]">Role focus</p>
                      <p className="font-semibold">{profilePanel.roleFocus}</p>
                    </div>
                    <div className="rounded-xl border border-[#2a436d] bg-[#102346] px-3 py-2">
                      <p className="text-xs text-[#9fb5da]">Experience level</p>
                      <p className="font-semibold">{profilePanel.experienceLevel}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-[#2a436d] bg-[#102346] px-3 py-2">
                    <p className="text-xs text-[#9fb5da]">Bio</p>
                    <p className="mt-1 text-sm text-[#d4e4ff]">{profilePanel.bio}</p>
                  </div>

                  <div className="mt-4 rounded-xl border border-[#2a436d] bg-[#102346] px-3 py-2">
                    <p className="text-xs text-[#9fb5da]">Strongest disciplines</p>
                    {profilePanel.strongest.length > 0 ? (
                      <p className="mt-1 text-sm font-semibold text-[#7ce2c2]">
                        {profilePanel.strongest.join(", ")}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-[#9fb5da]">No assessment signal yet.</p>
                    )}
                  </div>

                  <div className="mt-4 rounded-xl border border-[#2a436d] bg-[#102346] px-3 py-2">
                    <p className="text-xs text-[#9fb5da]">Mutual friends ({profilePanel.mutualFriends.length})</p>
                    {profilePanel.mutualFriends.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        {profilePanel.mutualFriends.map((entry) => (
                          <p key={entry.id} className="text-sm text-[#d4e4ff]">
                            {entry.fullName} <span className="text-[#92abcf]">@{entry.username}</span>
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-[#9fb5da]">No mutual friends yet.</p>
                    )}
                  </div>

                  {profilePanel.instagramUrl ? (
                    <a
                      href={profilePanel.instagramUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex rounded-xl border border-[#35527f] px-3 py-2 text-sm font-semibold transition hover:bg-[#12264d]"
                    >
                      Open Instagram
                    </a>
                  ) : null}

                  <Link
                    href={`/social/profile/${encodeURIComponent(profilePanel.username)}`}
                    className="mt-3 inline-flex rounded-xl border border-[#35527f] px-3 py-2 text-sm font-semibold transition hover:bg-[#12264d]"
                  >
                    Open full profile
                  </Link>
                </>
              )}
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
