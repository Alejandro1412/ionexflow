"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/actions/notifications";

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
  type: string;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function typeLabel(type: string) {
  if (type === "approval_pending") return "Approval";
  return "System";
}

export function NotificationBell({
  initialItems,
  unreadCount,
}: {
  initialItems: NotificationItem[];
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initialItems);
  const [unread, setUnread] = useState(unreadCount);
  const [pending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; right: number }>({
    top: 0,
    right: 16,
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setItems(initialItems);
    setUnread(unreadCount);
  }, [initialItems, unreadCount]);

  useLayoutEffect(() => {
    if (!open) return;

    function place() {
      const btn = rootRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      setPanelPos({
        top: rect.bottom + 10,
        right: Math.max(12, window.innerWidth - rect.right),
      });
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function onMarkOne(id: string) {
    setItems((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n
      )
    );
    setUnread((u) => Math.max(0, u - 1));
    startTransition(async () => {
      await markNotificationRead(id);
    });
  }

  function onMarkAll() {
    setItems((prev) =>
      prev.map((n) => ({
        ...n,
        read_at: n.read_at ?? new Date().toISOString(),
      }))
    );
    setUnread(0);
    startTransition(async () => {
      await markAllNotificationsRead();
    });
  }

  const panel =
    open && mounted
      ? createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Notifications"
            style={{ top: panelPos.top, right: panelPos.right }}
            className="fixed z-[9999] w-[min(calc(100vw-1.5rem),22.5rem)] origin-top-right animate-in fade-in zoom-in-95 duration-150"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-px rounded-[1.15rem] bg-gradient-to-br from-signal/35 via-transparent to-arc/25 opacity-80 blur-[1px]"
            />
            <div className="relative overflow-hidden rounded-[1.05rem] border border-white/12 bg-[#070b14]/96 shadow-[0_28px_90px_rgba(0,0,0,0.65),0_0_0_1px_rgba(61,255,242,0.1)_inset] backdrop-blur-2xl">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-signal/[0.09] to-transparent"
              />

              <header className="relative flex items-start justify-between gap-3 px-4 pb-3 pt-4">
                <div className="min-w-0">
                  <p className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-signal/90">
                    Inbox
                  </p>
                  <h2 className="mt-0.5 font-display text-lg font-semibold tracking-tight text-foreground">
                    Notifications
                  </h2>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {unread > 0
                      ? `${unread} waiting for you`
                      : "Everything is clear"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending || unread === 0}
                  onClick={onMarkAll}
                  className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:border-signal/30 hover:bg-signal/10 hover:text-signal disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Mark all read
                </button>
              </header>

              <div className="mx-4 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

              <ul className="relative max-h-[22rem] overflow-y-auto overscroll-contain px-2 py-2">
                {items.length === 0 ? (
                  <li className="flex flex-col items-center px-4 py-10 text-center">
                    <div className="relative mb-4 flex h-14 w-14 items-center justify-center">
                      <span
                        aria-hidden
                        className="absolute inset-0 rounded-full bg-signal/10 blur-md"
                      />
                      <span className="relative flex h-14 w-14 items-center justify-center rounded-full border border-signal/25 bg-gradient-to-b from-signal/15 to-transparent text-signal">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-6 w-6"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </span>
                    </div>
                    <p className="font-display text-sm font-semibold text-foreground">
                      You&apos;re all caught up
                    </p>
                    <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
                      When a workflow pauses for approval, it will land here
                      instantly.
                    </p>
                  </li>
                ) : (
                  items.map((item) => {
                    const unreadItem = !item.read_at;
                    const content = (
                      <>
                        <div
                          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                            unreadItem
                              ? "border-amber-400/35 bg-amber-400/10 text-amber-200"
                              : "border-white/10 bg-white/[0.04] text-muted-foreground"
                          }`}
                        >
                          {item.type === "approval_pending" ? (
                            <svg
                              viewBox="0 0 24 24"
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.7"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                              />
                            </svg>
                          ) : (
                            <svg
                              viewBox="0 0 24 24"
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.7"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                              {typeLabel(item.type)}
                            </span>
                            <span className="text-[10px] text-muted-foreground/80">
                              {timeAgo(item.created_at)}
                            </span>
                            {unreadItem ? (
                              <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-signal shadow-[0_0_8px_rgba(61,255,242,0.8)]" />
                            ) : null}
                          </div>
                          <p
                            className={`mt-1 truncate text-sm ${
                              unreadItem
                                ? "font-semibold text-foreground"
                                : "font-medium text-foreground/85"
                            }`}
                          >
                            {item.title}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {item.body}
                          </p>
                          {unreadItem ? (
                            <button
                              type="button"
                              className="mt-2 text-[11px] font-medium text-signal/90 hover:text-signal"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onMarkOne(item.id);
                              }}
                            >
                              Mark as read
                            </button>
                          ) : null}
                        </div>
                      </>
                    );

                    const rowClass = `group flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${
                      unreadItem
                        ? "bg-signal/[0.06] hover:bg-signal/[0.1]"
                        : "hover:bg-white/[0.04]"
                    }`;

                    return (
                      <li key={item.id} className="mb-0.5">
                        {item.href ? (
                          <Link
                            href={item.href}
                            prefetch={false}
                            className={rowClass}
                            onClick={() => {
                              if (unreadItem) onMarkOne(item.id);
                              setOpen(false);
                            }}
                          >
                            {content}
                          </Link>
                        ) : (
                          <div className={rowClass}>{content}</div>
                        )}
                      </li>
                    );
                  })
                )}
              </ul>

              <footer className="relative border-t border-white/[0.07] bg-black/25 px-3 py-2.5">
                <Link
                  href="/dashboard/notifications"
                  prefetch={false}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-muted-foreground transition hover:bg-white/[0.04] hover:text-signal"
                >
                  Open full inbox
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              </footer>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="relative z-[60]" ref={rootRef}>
      <button
        type="button"
        aria-label={unread ? `${unread} unread notifications` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className={`relative flex h-9 w-9 items-center justify-center rounded-full border transition duration-200 ${
          open
            ? "border-signal/50 bg-signal/15 text-signal shadow-[0_0_24px_rgba(61,255,242,0.22)]"
            : "border-white/10 bg-white/[0.04] text-muted-foreground hover:border-white/20 hover:bg-white/[0.08] hover:text-foreground"
        }`}
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="h-[17px] w-[17px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
          />
        </svg>
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-signal px-1 text-[10px] font-bold leading-none text-[#05070F] ring-2 ring-[#05070F] animate-pulse">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {panel}
    </div>
  );
}
