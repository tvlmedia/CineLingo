import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function sortedPair(a: string, b: string): { userA: string; userB: string } {
  return a < b ? { userA: a, userB: b } : { userA: b, userB: a };
}

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }

  return { userId: user.id, supabase };
}

async function ensureFriendship(supabase: Awaited<ReturnType<typeof createClient>>, a: string, b: string) {
  const pair = sortedPair(a, b);
  const { data } = await supabase
    .from("friendships")
    .select("user_a")
    .eq("user_a", pair.userA)
    .eq("user_b", pair.userB)
    .maybeSingle();
  return Boolean(data);
}

export async function GET(request: NextRequest) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  const { userId, supabase } = auth;
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");

  if (mode === "messages") {
    const friendId = String(url.searchParams.get("friendId") || "").trim();
    if (!friendId) {
      return NextResponse.json({ error: "missing_friend_id" }, { status: 400 });
    }

    const hasFriendship = await ensureFriendship(supabase, userId, friendId);
    if (!hasFriendship) {
      return NextResponse.json({ error: "not_friends" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, sender_id, receiver_id, body, created_at, read_at")
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: "query_failed" }, { status: 500 });
    }

    return NextResponse.json({ messages: data || [] });
  }

  if (mode === "unread") {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("sender_id")
      .eq("receiver_id", userId)
      .is("read_at", null);

    if (error) {
      return NextResponse.json({ error: "query_failed" }, { status: 500 });
    }

    const unreadByFriend: Record<string, number> = {};
    (data || []).forEach((row) => {
      const senderId = String(row.sender_id || "");
      if (!senderId) return;
      unreadByFriend[senderId] = (unreadByFriend[senderId] || 0) + 1;
    });
    return NextResponse.json({ unreadByFriend });
  }

  return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  const { userId, supabase } = auth;
  const body = (await request.json().catch(() => null)) as
    | { action?: string; friendId?: string; message?: string }
    | null;

  const action = String(body?.action || "");
  const friendId = String(body?.friendId || "").trim();

  if (!friendId) {
    return NextResponse.json({ error: "missing_friend_id" }, { status: 400 });
  }

  const hasFriendship = await ensureFriendship(supabase, userId, friendId);
  if (!hasFriendship) {
    return NextResponse.json({ error: "not_friends" }, { status: 403 });
  }

  if (action === "send") {
    const message = String(body?.message || "").trim();
    if (!message) {
      return NextResponse.json({ error: "missing_message" }, { status: 400 });
    }
    if (message.length > 1500) {
      return NextResponse.json({ error: "message_too_long" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        sender_id: userId,
        receiver_id: friendId,
        body: message,
      })
      .select("id, sender_id, receiver_id, body, created_at, read_at")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "send_failed" }, { status: 500 });
    }

    return NextResponse.json({ message: data });
  }

  if (action === "mark_read") {
    const readAt = new Date().toISOString();
    const { data, error } = await supabase
      .from("chat_messages")
      .update({ read_at: readAt })
      .eq("sender_id", friendId)
      .eq("receiver_id", userId)
      .is("read_at", null)
      .select("id");

    if (error) {
      return NextResponse.json({ error: "mark_read_failed" }, { status: 500 });
    }

    return NextResponse.json({ updated: (data || []).length, readAt });
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
