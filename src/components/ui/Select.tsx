"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import styles from "./Select.module.scss";

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Accessible name for the control (there is no visible <label>). */
  ariaLabel: string;
  /** Applied to the root wrapper so callers can own layout (width, flex). */
  className?: string;
  id?: string;
}

/**
 * Themed replacement for a native <select>. The native dropdown popup is
 * OS-drawn — its hover color can't be themed and it ignores `cursor: pointer`
 * on options. This renders the list ourselves so hover, cursor, and text
 * contrast all match the NeonBlade theme.
 *
 * Follows the WAI-ARIA "select-only combobox" pattern: focus stays on the
 * trigger and the active option is tracked with `aria-activedescendant`.
 */
export default function Select({ value, onChange, options, ariaLabel, className, id }: Props) {
  const [open, setOpen] = useState(false);
  // Highlighted option (keyboard nav + mouse hover share one highlight).
  const [activeIndex, setActiveIndex] = useState(-1);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Typeahead buffer + the timer that clears it after a pause.
  const typeahead = useRef("");
  const typeaheadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const baseId = useId();
  const listId = `${baseId}-list`;
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selectedLabel = selectedIndex >= 0 ? options[selectedIndex].label : "";

  const closeAndFocus = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const openList = useCallback(() => {
    // Start the highlight on the current selection (or the first option).
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }, [selectedIndex]);

  const commit = useCallback(
    (index: number) => {
      const opt = options[index];
      if (opt) onChange(opt.value);
      closeAndFocus();
    },
    [options, onChange, closeAndFocus],
  );

  // Close when a pointer/focus lands outside the component.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Keep the highlighted option scrolled into view during keyboard nav.
  // Options are the list's only children, so index them directly.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    (listRef.current?.children[activeIndex] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  useEffect(() => {
    return () => {
      if (typeaheadTimer.current) clearTimeout(typeaheadTimer.current);
    };
  }, []);

  const runTypeahead = useCallback(
    (char: string) => {
      typeahead.current += char.toLowerCase();
      if (typeaheadTimer.current) clearTimeout(typeaheadTimer.current);
      typeaheadTimer.current = setTimeout(() => {
        typeahead.current = "";
      }, 500);

      const query = typeahead.current;
      const from = open ? activeIndex : selectedIndex;
      // Search from just after the current position, wrapping around.
      for (let step = 1; step <= options.length; step++) {
        const i = (Math.max(from, 0) + step) % options.length;
        if (options[i].label.toLowerCase().startsWith(query)) {
          if (open) setActiveIndex(i);
          else onChange(options[i].value);
          return;
        }
      }
    },
    [open, activeIndex, selectedIndex, options, onChange],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) openList();
        else setActiveIndex((i) => Math.min(i + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) openList();
        else setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        if (open) {
          e.preventDefault();
          setActiveIndex(0);
        }
        break;
      case "End":
        if (open) {
          e.preventDefault();
          setActiveIndex(options.length - 1);
        }
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (open) commit(activeIndex);
        else openList();
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          closeAndFocus();
        }
        break;
      case "Tab":
        if (open) setOpen(false);
        break;
      default:
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          runTypeahead(e.key);
        }
    }
  };

  return (
    <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")}>
      <div
        ref={triggerRef}
        id={id}
        role="combobox"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        className={styles.trigger}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        <span className={selectedLabel ? styles.value : styles.placeholder}>{selectedLabel || options[0]?.label}</span>
        <span className={styles.chevron} aria-hidden="true" />
      </div>

      {open && (
        <ul ref={listRef} id={listId} role="listbox" aria-label={ariaLabel} className={styles.list}>
          {options.map((opt, i) => (
            <li
              key={opt.value}
              id={optionId(i)}
              role="option"
              aria-selected={opt.value === value}
              className={`${styles.option} ${i === activeIndex ? styles.active : ""}`}
              // Mouse and keyboard share one highlight — hovering moves it.
              onMouseEnter={() => setActiveIndex(i)}
              // Commit before the trigger's outside-pointerdown can close first.
              onPointerDown={(e) => {
                e.preventDefault();
                commit(i);
              }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
