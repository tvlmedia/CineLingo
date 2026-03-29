"use client";

import { FormEvent, useEffect, useState } from "react";

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
  const [selectedChatId, setSelectedChatId] = useState(initialSelectedChatId);
  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>(initialMessages);
  const [pendingMessage, setPendingMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
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
    if (!selectedChatId) {
      setChatMessages([]);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function loadMessagesForSelectedFriend() {
      const response = await fetch(`/api/chat?mode=messages&friendId=${encodeURIComponent(selectedChatId)}`, {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { messages?: ChatMessageItem[] };

      if (!cancelled) {
        setChatMessages(payload.messages || []);
      }
    }

    loadMessagesForSelectedFriend();
    timer = setInterval(loadMessagesForSelectedFriend, 1500);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [selectedChatId]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function loadUnreadCounts() {
      const response = await fetch("/api/chat?mode=unread", {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { unreadByFriend?: Record<string, number> };
      if (!cancelled) {
        setUnreadByFriend(payload.unreadByFriend || {});
      }
    }

    loadUnreadCounts();
    timer = setInterval(loadUnreadCounts, 1800);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

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

    fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "mark_read",
        friendId: selectedChatId,
      }),
    });
  }, [chatMessages, currentUserId, selectedChatId]);

  async function handleSend(event: FormEvent) {
    event.preventDefault();

    if (!selectedChatId || !pendingMessage.trim() || isSending) {
      return;
    }

    const body = pendingMessage.trim();
    setPendingMessage("");
    setIsSending(true);
    setChatError(null);

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

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "send",
        friendId: selectedChatId,
        message: body,
      }),
    });

    if (!response.ok) {
      setChatMessages((prev) => prev.filter((entry) => entry.id !== optimisticId));
      setChatError("Bericht kon niet verzonden worden.");
    } else {
      const payload = (await response.json()) as { message?: ChatMessageItem };
      const data = payload.message;
      if (!data) {
        setChatMessages((prev) => prev.filter((entry) => entry.id !== optimisticId));
        setChatError("Bericht kon niet verzonden worden.");
      } else {
        setChatMessages((prev) =>
          prev.map((entry) => (entry.id === optimisticId ? data : entry))
        );
      }
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
            {chatError ? (
              <p className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {chatError}
              </p>
            ) : null}
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
