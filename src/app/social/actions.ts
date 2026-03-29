"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function cleanInput(value: string): string {
  return value.trim();
}

function cleanUsername(value: string): string {
  return cleanInput(value).replace(/^@+/, "");
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function looksLikePhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7;
}

function normalizePhoneForSearch(value: string): string {
  const digits = value.replace(/\D/g, "");
  return `+${digits}`;
}

function sortedPair(a: string, b: string): { userA: string; userB: string } {
  return a < b ? { userA: a, userB: b } : { userA: b, userB: a };
}

async function findTargetUserIdByIdentifier(
  identifierInput: string,
  currentUserId: string
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const identifier = cleanInput(identifierInput);
  if (!identifier) {
    return { error: "missing_identifier" };
  }

  type ProfileMatch = {
    id: string;
    username: string | null;
    full_name: string | null;
    email: string | null;
    phone: string | null;
  };

  let matches: ProfileMatch[] = [];

  if (looksLikeEmail(identifier)) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, email, phone")
      .eq("email", identifier.toLowerCase())
      .limit(2);
    if (error) return { error: "request_failed" };
    matches = (data || []) as ProfileMatch[];
  } else if (identifier.startsWith("@")) {
    const username = cleanUsername(identifier);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, email, phone")
      .ilike("username", username)
      .limit(2);
    if (error) return { error: "request_failed" };
    matches = (data || []) as ProfileMatch[];
  } else if (looksLikePhone(identifier)) {
    const normalizedPhone = normalizePhoneForSearch(identifier);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, email, phone")
      .ilike("phone", `%${normalizedPhone.slice(1)}%`)
      .limit(2);
    if (error) return { error: "request_failed" };
    matches = (data || []) as ProfileMatch[];
  } else {
    const username = cleanUsername(identifier);
    const { data: usernameData, error: usernameError } = await supabase
      .from("profiles")
      .select("id, username, full_name, email, phone")
      .ilike("username", username)
      .limit(2);
    if (usernameError) return { error: "request_failed" };

    if ((usernameData || []).length > 0) {
      matches = (usernameData || []) as ProfileMatch[];
    } else {
      const { data: fullNameData, error: fullNameError } = await supabase
        .from("profiles")
        .select("id, username, full_name, email, phone")
        .ilike("full_name", `%${identifier}%`)
        .limit(2);
      if (fullNameError) return { error: "request_failed" };
      matches = (fullNameData || []) as ProfileMatch[];
    }
  }

  const filtered = matches.filter((row) => row.id !== currentUserId);
  if (filtered.length === 0) {
    return { error: "user_not_found" };
  }
  if (filtered.length > 1) {
    return { error: "multiple_matches" };
  }

  return { id: filtered[0].id };
}

export async function sendFriendRequest(formData: FormData): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  const identifierInput = String(formData.get("identifier") || "");

  const targetResult = await findTargetUserIdByIdentifier(identifierInput, user.id);
  if ("error" in targetResult) {
    redirect(`/social?error=${targetResult.error}`);
  }
  const receiverId = targetResult.id;

  if (receiverId === user.id) {
    redirect("/social?error=self_add");
  }

  const pair = sortedPair(user.id, receiverId);
  const { data: existingFriendship } = await supabase
    .from("friendships")
    .select("user_a")
    .eq("user_a", pair.userA)
    .eq("user_b", pair.userB)
    .maybeSingle();

  if (existingFriendship) {
    redirect("/social?error=already_friends");
  }

  const { data: outgoingExisting, error: outgoingExistingError } = await supabase
    .from("friend_requests")
    .select("id, status")
    .eq("sender_id", user.id)
    .eq("receiver_id", receiverId)
    .maybeSingle();

  if (outgoingExistingError) {
    redirect("/social?error=request_failed");
  }

  if (outgoingExisting?.status === "pending") {
    redirect("/social?error=already_sent");
  }

  const { data: incomingExisting, error: incomingExistingError } = await supabase
    .from("friend_requests")
    .select("id, status")
    .eq("sender_id", receiverId)
    .eq("receiver_id", user.id)
    .maybeSingle();

  if (incomingExistingError) {
    redirect("/social?error=request_failed");
  }

  if (incomingExisting?.status === "pending") {
    redirect("/social?error=incoming_pending");
  }

  if (outgoingExisting) {
    const { error: resendError } = await supabase
      .from("friend_requests")
      .update({
        status: "pending",
        responded_at: null,
      })
      .eq("id", outgoingExisting.id)
      .eq("sender_id", user.id);

    if (resendError) {
      redirect("/social?error=request_failed");
    }
  } else {
    const { error: insertError } = await supabase.from("friend_requests").insert({
      sender_id: user.id,
      receiver_id: receiverId,
      status: "pending",
      responded_at: null,
    });

    if (insertError) {
      redirect("/social?error=request_failed");
    }
  }

  redirect("/social?sent=1");
}

export async function acceptFriendRequest(formData: FormData): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  const requestId = String(formData.get("requestId") || "").trim();

  if (!requestId) {
    redirect("/social?error=request_failed");
  }

  const { data: acceptedRequest, error: acceptError } = await supabase
    .from("friend_requests")
    .update({
      status: "accepted",
      responded_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("receiver_id", user.id)
    .eq("status", "pending")
    .select("sender_id, receiver_id")
    .maybeSingle();

  if (acceptError || !acceptedRequest) {
    redirect("/social?error=request_failed");
  }

  const pair = sortedPair(
    acceptedRequest.sender_id as string,
    acceptedRequest.receiver_id as string
  );
  await supabase.from("friendships").upsert(
    {
      user_a: pair.userA,
      user_b: pair.userB,
    },
    { onConflict: "user_a,user_b" }
  );

  redirect("/social?accepted=1");
}

export async function declineFriendRequest(formData: FormData): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  const requestId = String(formData.get("requestId") || "").trim();

  if (!requestId) {
    redirect("/social?error=request_failed");
  }

  const { error } = await supabase
    .from("friend_requests")
    .update({
      status: "declined",
      responded_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("receiver_id", user.id)
    .eq("status", "pending");

  if (error) {
    redirect("/social?error=request_failed");
  }

  redirect("/social?declined=1");
}

export async function cancelFriendRequest(formData: FormData): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  const requestId = String(formData.get("requestId") || "").trim();

  if (!requestId) {
    redirect("/social?error=request_failed");
  }

  const { error } = await supabase
    .from("friend_requests")
    .delete()
    .eq("id", requestId)
    .eq("sender_id", user.id)
    .eq("status", "pending");

  if (error) {
    redirect("/social?error=request_failed");
  }

  redirect("/social?cancelled=1");
}

export async function sendChatMessage(formData: FormData): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  const receiverId = String(formData.get("receiverId") || "").trim();
  const message = String(formData.get("message") || "").trim();

  if (!receiverId || !message) {
    redirect("/social?error=chat_failed");
  }

  if (receiverId === user.id) {
    redirect("/social?error=chat_failed");
  }

  if (message.length > 1500) {
    redirect(`/social?chat=${receiverId}&error=chat_too_long`);
  }

  const pair = sortedPair(user.id, receiverId);
  const { data: friendship, error: friendshipError } = await supabase
    .from("friendships")
    .select("user_a")
    .eq("user_a", pair.userA)
    .eq("user_b", pair.userB)
    .maybeSingle();

  if (friendshipError || !friendship) {
    redirect("/social?error=not_friends");
  }

  const { error } = await supabase.from("chat_messages").insert({
    sender_id: user.id,
    receiver_id: receiverId,
    body: message,
  });

  if (error) {
    redirect(`/social?chat=${receiverId}&error=chat_failed`);
  }

  redirect(`/social?chat=${receiverId}&sentMessage=1`);
}
