"use client";

import { type ReactNode, useEffect, useRef } from "react";
import styles from "./Modal.module.scss";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  size?: "default" | "wide";
  /** "default" cuts the bottom-left + top-right corners; "br" cuts only bottom-right. */
  corner?: "default" | "br";
  children: ReactNode;
}

/** Accessible modal dialog: focus trap, Escape to close, backdrop click to close. */
export default function Modal({
  open,
  onClose,
  labelledBy,
  size = "default",
  corner = "default",
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

    getFocusable()[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const focusable = getFocusable();
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        // Focus can escape to <body> when the focused control is disabled or
        // unmounted mid-interaction (e.g. a Cancel button that removes its own
        // row). Pull it back into the dialog rather than letting Tab walk the
        // background page.
        if (!active || !dialogRef.current?.contains(active)) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
          return;
        }
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
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
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={`${styles.backdrop} neon-backdrop-tint`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`${styles.glowWrap} ${size === "wide" ? styles.glowWrapWide : ""} ${
          corner === "br" ? styles.cornerBr : ""
        }`}
      >
        <div className={styles.borderWrap}>
          <div ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
