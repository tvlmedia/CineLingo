"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type FriendItem = {
  id: string;
  username: string;
  fullName: string;
  unreadCount: number;
};

type ChatMessageItem = {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

type SocialNetworkClientProps = {
  currentUserId: string;
  friends: FriendItem[];
  initialSelectedChatId: string;
  initialMessages: ChatMessageItem[];
};

function formatClockTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function SocialNetworkClient({
  currentUserId,
  friends,
  initialSelectedChatId,
  initialMessages,
}: SocialNetworkClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const [selectedChatId, setSelectedChatId] = useState(initialSelectedChatId);
  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>(initialMessages);
  const [pendingMessage, setPendingMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [unreadByFriend, setUnreadByFriend] = useState<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    friends.forEach((friend) => {
      out[friend.id] = friend.unreadCount;
    });
    return out;
  });

  useEffect(() => {
    setSelectedChatId(initialSelectedChatId);
  }, [initialSelectedChatId]);

  useEffect(() => {
    setChatMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    let cancelled = false;

    async function loadMessagesForSelectedFriend() {
      if (!selectedChatId) {
        setChatMessages([]);
        return;
      }

      const { data } = await supabase
        .from("chat_messages")
        .select("id, sender_id, receiver_id, body, created_at, read_at")
        .or(
          `and(sender_id.eq.${currentUserId},receiver_id.eq.${selectedChatId}),and(sender_id.eq.${selectedChatId},receiver_id.eq.${currentUserId})`
        )
        .order("created_at", { ascending: true })
        .limit(200);

      if (!cancelled) {
        setChatMessages((data || []) as ChatMessageItem[]);
      }
    }

    loadMessagesForSelectedFriend();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, selectedChatId, supabase]);

  useEffect(() => {
    if (!selectedChatId) {
      return;
    }

    const unreadFromSelected = chatMessages.filter(
      (message) =>
        message.sender_id === selectedChatId &&
        message.receiver_id === currentUserId &&
        message.read_at === null
    );
    if (unreadFromSelected.length === 0) {
      return;
    }

    const unreadIds = unreadFromSelected.map((message) => message.id);
    const readAt = new Date().toISOString();

    setChatMessages((prev) =>
      prev.map((message) =>
        unreadIds.includes(message.id) ? { ...message, read_at: readAt } : message
      )
    );
    setUnreadByFriend((prev) => ({ ...prev, [selectedChatId]: 0 }));

    supabase
      .from("chat_messages")
      .update({ read_at: readAt })
      .in("id", unreadIds)
      .eq("receiver_id", currentUserId);
  }, [chatMessages, currentUserId, selectedChatId, supabase]);

  useEffect(() => {
    const channel = supabase
      .channel(`social-chat-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        (payload) => {
          const message = payload.new as ChatMessageItem;
          const related =
            (message.sender_id === currentUserId && message.receiver_id === selectedChatId) ||
            (message.sender_id === selectedChatId && message.receiver_id === currentUserId);

          if (related) {
            setChatMessages((prev) =>
              prev.some((entry) => entry.id === message.id) ? prev : [...prev, message]
            );
          }

          if (message.receiver_id === currentUserId && message.sender_id !== selectedChatId) {
            setUnreadByFriend((prev) => ({
              ...prev,
              [message.sender_id]: (prev[message.sender_id] || 0) + 1,
            }));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_messages",
        },
        (payload) => {
          const message = payload.new as ChatMessageItem;
          setChatMessages((prev) =>
            prev.map((entry) => (entry.id === message.id ? message : entry))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, selectedChatId, supabase]);

  async function handleSend(event: FormEvent) {
    event.preventDefault();

    if (!selectedChatId || !pendingMessage.trim() || isSending) {
      return;
    }

    const body = pendingMessage.trim();
    setPendingMessage("");
    setIsSending(true);

    const optimisticId = `tmp-${Date.now()}`;
    const optimisticMessage: ChatMessageItem = {
      id: optimisticId,
      sender_id: currentUserId,
      receiver_id: selectedChatId,
      body,
      created_at: new Date().toISOString(),
      read_at: null,
    };

    setChatMessages((prev) => [...prev, optimisticMessage]);

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        sender_id: currentUserId,
        receiver_id: selectedChatId,
        body,
      })
      .select("id, sender_id, receiver_id, body, created_at, read_at")
      .single();

    if (error || !data) {
      setChatMessages((prev) => prev.filter((entry) => entry.id !== optimisticId));
    } else {
      setChatMessages((prev) =>
        prev.map((entry) => (entry.id === optimisticId ? (data as ChatMessageItem) : entry))
      );
    }

    setIsSending(false);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-card p-6 shadow-[0_24px_60px_rgba(1,7,18,0.4)] backdrop-blur-sm">
        <h2 className="mb-3 text-2xl font-semibold">Friends</h2>
        <div className="space-y-3">
          {friends.length === 0 ? (
            <p className="text-sm text-muted">No friends yet.</p>
          ) : (
            friends.map((friend) => {
              const isActive = selectedChatId === friend.id;
              const unreadCount = unreadByFriend[friend.id] || 0;

              return (
                <button
                  key={friend.id}
                  type="button"
                  onClick={() => setSelectedChatId(friend.id)}
                  className={`flex w-full items-center justify-between rounded-2xl border p-3 text-left transition ${
                    isActive ? "border-accent bg-white/10" : "border-border bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <div>
                    <p className="font-semibold">{friend.fullName}</p>
                    <p className="text-xs text-muted">@{friend.username}</p>
                  </div>
                  {unreadCount > 0 ? (
                    <span className="rounded-full bg-accent px-2 py-1 text-xs font-semibold text-[#04231d]">
                      {unreadCount}
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-6 shadow-[0_24px_60px_rgba(1,7,18,0.4)] backdrop-blur-sm">
        <h2 className="mb-3 text-2xl font-semibold">Chat</h2>
        {!selectedChatId ? (
          <p className="text-sm text-muted">Select a friend to start chatting.</p>
        ) : (
          <>
            <div className="mb-4 h-[340px] space-y-2 overflow-y-auto rounded-2xl border border-border bg-white/5 p-3">
              {chatMessages.length === 0 ? (
                <p className="text-sm text-muted">No messages yet.</p>
              ) : (
                chatMessages.map((messageItem) => {
                  const mine = messageItem.sender_id === currentUserId;
                  const readLabel = mine
                    ? messageItem.read_at
                      ? "Seen ✓✓"
                      : "Sent ✓"
                    : "";
                  return (
                    <div key={messageItem.id} className={mine ? "ml-auto max-w-[85%]" : "max-w-[85%]"}>
                      <div
                        className={`rounded-xl px-3 py-2 text-sm ${
                          mine
                            ? "bg-accent text-[#04231d]"
                            : "border border-border bg-[#0f2242] text-foreground"
                        }`}
                      >
                        {messageItem.body}
                      </div>
                      <p className="mt-1 text-[11px] text-muted">
                        {formatClockTime(messageItem.created_at)} {readLabel}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
            <form onSubmit={handleSend} className="space-y-3">
              <textarea
                value={pendingMessage}
                onChange={(event) => setPendingMessage(event.target.value)}
                rows={3}
                placeholder="Write a message..."
                required
              />
              <button
                type="submit"
                disabled={isSending}
                className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#04231d] disabled:opacity-60"
              >
                {isSending ? "Sending..." : "Send"}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
