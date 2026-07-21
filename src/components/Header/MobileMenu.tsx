"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { SessionUser } from "@/lib/types";
import styles from "./MobileMenu.module.scss";

interface Props {
  user: SessionUser;
  onSignOut: () => void;
  onOpenMyEvents: () => void;
  onCreateEvent?: () => void;
}

const subscribeNoop = () => () => {};

export default function MobileMenu({ user, onSignOut, onOpenMyEvents, onCreateEvent }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  // document.body (the portal target) only exists on the client.
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  // Escape to close, focus trap, and body-scroll lock — only while open.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

    getFocusable()[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === "Tab") {
        const focusable = getFocusable();
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  const handleMyEvents = () => {
    setOpen(false);
    onOpenMyEvents();
  };
  const handleCreateEvent = () => {
    setOpen(false);
    onCreateEvent?.();
  };
  const handleSignOut = () => {
    setOpen(false);
    onSignOut();
  };

  return (
    <>
      <button
        className={styles.hamburger}
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        type="button"
      >
        <span className={styles.bar} />
        <span className={styles.bar} />
        <span className={styles.bar} />
      </button>

      {/* Portaled to <body> so `position: fixed` escapes the header's
          backdrop-filter containing block and fills the viewport. */}
      {mounted &&
        createPortal(
          <>
            <div
              className={`${styles.backdrop} ${open ? styles.backdropOpen : ""}`}
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <aside
              ref={panelRef}
              className={`${styles.drawer} ${open ? styles.drawerOpen : ""}`}
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              aria-hidden={!open}
              inert={!open}
            >
              <div className={styles.drawerHead}>
                <button className={styles.close} onClick={() => setOpen(false)} aria-label="Close menu" type="button">
                  ×
                </button>
              </div>

              <div className={styles.account}>
                <span className={styles.name}>{user.name}</span>
                <span className={styles.role}>{user.role}</span>
                <button className={styles.signOut} onClick={handleSignOut} type="button">
                  Sign Out
                </button>
              </div>

              <div className={styles.separator} />
              <nav className={styles.menu} aria-label="Menu">
                <button className={styles.menuItem} onClick={handleMyEvents} type="button">
                  My Events
                </button>
                {onCreateEvent && (
                  <button className={styles.menuItem} onClick={handleCreateEvent} type="button">
                    Create New Event
                  </button>
                )}
              </nav>
            </aside>
          </>,
          document.body,
        )}
    </>
  );
}
