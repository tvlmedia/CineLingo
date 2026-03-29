"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function cleanUsername(value: string): string {
  return value.trim().replace(/^@+/, "");
}

function sortedPair(a: string, b: string): { userA: string; userB: string } {
  return a < b ? { userA: a, userB: b } : { userA: b, userB: a };
}

export async function sendFriendRequest(formData: FormData): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  const usernameInput = cleanUsername(String(formData.get("username") || ""));

  if (!usernameInput) {
    redirect("/social?error=missing_username");
  }

  const { data: targetProfiles, error: targetError } = await supabase
    .from("profiles")
    .select("id, username")
    .ilike("username", usernameInput)
    .limit(1);

  if (targetError || !targetProfiles?.length) {
    redirect("/social?error=user_not_found");
  }

  const receiverId = targetProfiles[0].id as string;
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
