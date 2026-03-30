"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type ChatMessageItem = {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

type SelectedFriend = {
  id: string;
  fullName: string;
  username: string;
  avatarUrl: string | null;
  levelLabel: string;
};

type SocialNetworkClientProps = {
  currentUserId: string;
  selectedFriend: SelectedFriend | null;
  initialMessages: ChatMessageItem[];
};

function formatClockTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function SocialNetworkClient({
  currentUserId,
  selectedFriend,
  initialMessages,
}: SocialNetworkClientProps) {
  const selectedChatId = selectedFriend?.id || "";
  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>(initialMessages);
  const [pendingMessage, setPendingMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    setChatMessages(initialMessages);
  }, [initialMessages, selectedChatId]);

  useEffect(() => {
    if (!selectedChatId) {
      setChatMessages([]);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function loadMessagesForSelectedFriend() {
      const response = await fetch(
        `/api/chat?mode=messages&friendId=${encodeURIComponent(selectedChatId)}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { messages?: ChatMessageItem[] };

      if (!cancelled) {
        setChatMessages(payload.messages || []);
      }
    }

    loadMessagesForSelectedFriend();
    timer = setInterval(loadMessagesForSelectedFriend, 1300);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [selectedChatId]);

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

    const unreadIds = new Set(unreadFromSelected.map((message) => message.id));
    const readAt = new Date().toISOString();

    setChatMessages((prev) =>
      prev.map((message) =>
        unreadIds.has(message.id) ? { ...message, read_at: readAt } : message
      )
    );

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
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; details?: string }
        | null;
      setChatMessages((prev) => prev.filter((entry) => entry.id !== optimisticId));
      const detail = String(payload?.details || payload?.error || "").trim();
      setChatError(
        detail
          ? `Bericht kon niet verzonden worden: ${detail}`
          : "Bericht kon niet verzonden worden."
      );
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

  const chatSubtitle = useMemo(() => {
    if (!selectedFriend) return "Selecteer een filmmaker om te chatten.";
    return `Chat met ${selectedFriend.fullName} (@${selectedFriend.username})`;
  }, [selectedFriend]);

  return (
    <section className="rounded-2xl border border-border bg-[#16171a] p-5 md:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Direct chat</p>
          <h2 className="mt-1 text-2xl font-semibold">Conversation</h2>
          <p className="mt-1 text-sm text-muted">{chatSubtitle}</p>
        </div>
        {selectedFriend ? (
          <div className="rounded-xl border border-border bg-[#1b1c20] px-3 py-2 text-right">
            <p className="text-xs text-muted">Current level</p>
            <p className="text-sm font-semibold">{selectedFriend.levelLabel}</p>
          </div>
        ) : null}
      </div>

      {!selectedFriend ? (
        <div className="flex h-[560px] items-center justify-center rounded-2xl border border-border bg-[#1b1c20] px-6 text-center text-sm text-muted">
          Kies links een connectie om direct te starten.
        </div>
      ) : (
        <>
          <div className="mb-4 h-[460px] space-y-2 overflow-y-auto rounded-2xl border border-border bg-[#1b1c20] p-3">
            {chatMessages.length === 0 ? (
              <p className="text-sm text-muted">Nog geen berichten in deze conversatie.</p>
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
                          ? "bg-accent text-[#13100a]"
                          : "border border-border bg-[#1b1c20] text-foreground"
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
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#13100a] disabled:opacity-60"
            >
              {isSending ? "Sending..." : "Send"}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
