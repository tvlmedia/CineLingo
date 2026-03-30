"use client";

import { useEffect } from "react";

const PREWARM_LOCAL_KEY = "cinelingo_practice_prewarm_at";
const PREWARM_THROTTLE_MS = 1000 * 60 * 4;

export function PracticePrewarm({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;

    const now = Date.now();
    const lastAtRaw = window.localStorage.getItem(PREWARM_LOCAL_KEY);
    const lastAt = Number(lastAtRaw || 0);

    if (Number.isFinite(lastAt) && now - lastAt < PREWARM_THROTTLE_MS) {
      return;
    }

    window.localStorage.setItem(PREWARM_LOCAL_KEY, String(now));

    void fetch("/api/practice/prewarm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: "dashboard_view" }),
      keepalive: true,
    }).catch(() => {
      // intentionally ignore; prewarm is opportunistic only
    });
  }, [enabled]);

  return null;
}
