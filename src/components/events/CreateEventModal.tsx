"use client";

import {
  cloneElement,
  isValidElement,
  type FormEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import {
  createEventSchema,
  GAME_TYPES,
  LIMITS,
  SKILL_LEVELS,
  type CreateEventPayload,
} from "@/lib/eventSchema";
import type { ApiError } from "@/lib/apiClient";
import styles from "./CreateEventModal.module.scss";

interface Props {
  onClose: () => void;
  onCreate: (payload: CreateEventPayload) => Promise<void>;
}

interface FormState {
  title: string;
  gameType: string;
  date: string;
  time: string;
  location: string;
  capacity: string;
  entryFee: string; // dollars
  durationMinutes: string;
  skillLevel: string;
  format: string;
  prizes: string;
  description: string;
}

const EMPTY: FormState = {
  title: "",
  gameType: "",
  date: "",
  time: "",
  location: "",
  capacity: "",
  entryFee: "",
  durationMinutes: "",
  skillLevel: "",
  format: "",
  prizes: "",
  description: "",
};

const DURATIONS = [
  { label: "1 hour", value: "60" },
  { label: "1.5 hours", value: "90" },
  { label: "2 hours", value: "120" },
  { label: "3 hours", value: "180" },
  { label: "4 hours", value: "240" },
  { label: "5 hours", value: "300" },
];

const POOLS = {
  titles: ["Friday Night Magic", "Commander Chaos", "Locals Championship", "Prerelease Party", "Casual Draft Night", "Store Showdown", "Weekend Meetup", "Game Day"],
  locations: ["The Deckmaster · 214 Elm St", "Mana Vault Games · 88 Oak Ave", "Duelist HQ · 5 Market Sq", "Meeple & Co · 340 Birch Blvd", "The Rolling Dice · 77 Cedar Ln"],
  formats: ["Standard Constructed · 4 rounds Swiss", "Booster Draft · 3 rounds", "Commander · 4-player pods", "Sealed Deck · Swiss + Top 8"],
  prizes: ["Booster packs by record + a foil promo", "Store credit to the top finishers", "Prize packs and a raffle entry", "Casual play — no prizes, just for fun"],
  descriptions: [
    "A welcoming weekly event for players of every stripe. Bring a legal deck and jump in — we'll pair you into rounds and keep things moving. New players encouraged; we can lend a starter deck.",
    "Come test your latest brew against the local meta. Rounds are Swiss with a friendly but competitive crowd. Snacks available and plenty of table space.",
    "Our flagship night for this game — expect a full field, good games, and strong prize support. Sleeves recommended.",
  ],
  fees: ["0", "5", "10", "15"],
} as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Map a zod/server field name to the form field used for error display.
function toFormKey(field: string): string {
  if (field === "startsAt") return "datetime";
  if (field === "entryFeeCents") return "entryFee";
  return field;
}

type ErrorKey = keyof FormState | "datetime" | "_form";

function Labeled({
  label,
  htmlFor,
  error,
  full,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  full?: boolean;
  children: ReactNode;
}) {
  const errorId = `${htmlFor}-error`;
  // Link the control to its error so screen readers announce it on focus, and
  // flag it invalid — done here so every field gets it without repetition.
  // Merge with any describedby the child already carries (e.g. a hint) rather
  // than clobbering it.
  const child = isValidElement(children)
    ? (children as ReactElement<Record<string, unknown>>)
    : null;
  const control =
    error && child
      ? cloneElement(child, {
          "aria-invalid": true,
          "aria-describedby": [child.props["aria-describedby"], errorId]
            .filter(Boolean)
            .join(" "),
        })
      : children;
  return (
    <div className={`${styles.field} ${full ? styles.full : ""}`}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
      </label>
      {control}
      {error ? (
        <span className={styles.error} id={errorId}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

export default function CreateEventModal({ onClose, onCreate }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<ErrorKey, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const submitInFlight = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const set = (key: keyof FormState, value: string) => setForm((f) => ({ ...f, [key]: value }));

  // While the POST is in flight, Escape/backdrop/×/Cancel must not dismiss the
  // modal — the request would still complete, silently creating an event the
  // organizer thinks they aborted (and likely a duplicate when they retry).
  const safeClose = () => {
    if (submitInFlight.current) return;
    onClose();
  };

  // After a failed submit, move focus to the first invalid field (in DOM order)
  // so keyboard/screen-reader users land on the problem instead of hunting for it.
  useEffect(() => {
    if (Object.keys(errors).length === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);

  const autoFill = () => {
    setForm((prev) => {
      const next = { ...prev };
      if (!next.title.trim()) next.title = pick(POOLS.titles);
      if (!next.gameType) next.gameType = pick(GAME_TYPES);
      if (!next.date) {
        const d = new Date();
        d.setDate(d.getDate() + 1 + Math.floor(Math.random() * 5)); // 1–5 days out
        next.date = toDateInputValue(d);
      }
      if (!next.time) next.time = "17:00"; // 5:00 PM
      if (!next.location.trim()) next.location = pick(POOLS.locations);
      // `=== ""` not falsiness: a typed "0" should surface as a validation
      // error, not be silently replaced.
      if (next.capacity === "") next.capacity = String(8 + Math.floor(Math.random() * 41)); // 8–48
      if (next.entryFee === "") next.entryFee = pick(POOLS.fees);
      if (!next.durationMinutes) next.durationMinutes = pick(DURATIONS).value;
      if (!next.skillLevel) next.skillLevel = pick(SKILL_LEVELS);
      if (!next.format.trim()) next.format = pick(POOLS.formats);
      if (!next.prizes.trim()) next.prizes = pick(POOLS.prizes);
      if (!next.description.trim()) next.description = pick(POOLS.descriptions);
      return next;
    });
    setErrors({});
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitInFlight.current) return;

    // Phase 1: everything filled in ("completely filled out").
    const required: Partial<Record<ErrorKey, string>> = {};
    (Object.keys(EMPTY) as (keyof FormState)[]).forEach((k) => {
      if (form[k].trim() === "") required[k] = "Required.";
    });
    if (Object.keys(required).length > 0) {
      setErrors(required);
      return;
    }

    // Phase 2: value-level validation via the shared schema.
    const start = new Date(`${form.date}T${form.time}`);
    const payload = {
      title: form.title,
      gameType: form.gameType,
      startsAt: Number.isNaN(start.getTime()) ? "" : start.toISOString(),
      location: form.location,
      capacity: Number(form.capacity),
      description: form.description,
      format: form.format,
      prizes: form.prizes,
      skillLevel: form.skillLevel,
      entryFeeCents: Math.round(Number(form.entryFee) * 100),
      durationMinutes: Number(form.durationMinutes),
    };

    const result = createEventSchema.safeParse(payload);
    if (!result.success) {
      const next: Partial<Record<ErrorKey, string>> = {};
      for (const issue of result.error.issues) {
        const key = toFormKey(String(issue.path[0])) as ErrorKey;
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    submitInFlight.current = true;
    setSubmitting(true);
    setErrors({});
    try {
      await onCreate(result.data);
      onClose();
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.fieldErrors) {
        const next: Partial<Record<ErrorKey, string>> = {};
        for (const [field, message] of Object.entries(apiErr.fieldErrors)) {
          const key = toFormKey(field);
          // Any error key that isn't one of our form fields (e.g. the server's
          // catch-all "_") must still display somewhere — fall back to the
          // form-level message instead of silently dropping it.
          if (key in EMPTY || key === "datetime") next[key as ErrorKey] = message;
          else if (!next._form) next._form = message;
        }
        if (Object.keys(next).length === 0) {
          next._form = apiErr.message ?? "Could not create the event. Please try again.";
        }
        setErrors(next);
      } else {
        setErrors({ _form: apiErr.message ?? "Could not create the event. Please try again." });
      }
    } finally {
      submitInFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={safeClose} labelledBy="create-event-title" size="wide">
      <div className={styles.head}>
        <h2 id="create-event-title" className={styles.title}>
          Create New Event
        </h2>
        <button
          className={styles.close}
          onClick={safeClose}
          aria-label="Close"
          type="button"
          disabled={submitting}
        >
          ×
        </button>
      </div>

      <div className={styles.autofillRow}>
        <span className={styles.autofillHint}>Testing? Fill any empty fields with sample data.</span>
        <button type="button" className={styles.autofill} onClick={autoFill}>
          Auto-Fill Form
        </button>
      </div>

      <form ref={formRef} className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.grid}>
          <Labeled full label="Event title" htmlFor="ce-title" error={errors.title}>
            <input
              id="ce-title"
              className={styles.control}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              maxLength={LIMITS.title.max}
              placeholder="Friday Night Magic"
            />
          </Labeled>

          <Labeled label="Game" htmlFor="ce-game" error={errors.gameType}>
            <select id="ce-game" className={styles.control} value={form.gameType} onChange={(e) => set("gameType", e.target.value)}>
              <option value="" disabled>
                Choose a game…
              </option>
              {GAME_TYPES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Labeled>

          <Labeled label="Skill level" htmlFor="ce-skill" error={errors.skillLevel}>
            <select id="ce-skill" className={styles.control} value={form.skillLevel} onChange={(e) => set("skillLevel", e.target.value)}>
              <option value="" disabled>
                Choose…
              </option>
              {SKILL_LEVELS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Labeled>

          <Labeled label="Date" htmlFor="ce-date" error={errors.date ?? errors.datetime}>
            <input id="ce-date" type="date" className={styles.control} value={form.date} onChange={(e) => set("date", e.target.value)} />
          </Labeled>
          <Labeled label="Time" htmlFor="ce-time" error={errors.time}>
            <input id="ce-time" type="time" className={styles.control} value={form.time} onChange={(e) => set("time", e.target.value)} />
          </Labeled>

          <Labeled full label="Location" htmlFor="ce-loc" error={errors.location}>
            <input
              id="ce-loc"
              className={styles.control}
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              maxLength={LIMITS.location.max}
              placeholder="Store name · Street address"
            />
          </Labeled>

          <Labeled label="Capacity" htmlFor="ce-cap" error={errors.capacity}>
            <input
              id="ce-cap"
              type="number"
              min={LIMITS.capacity.min}
              max={LIMITS.capacity.max}
              className={styles.control}
              value={form.capacity}
              onChange={(e) => set("capacity", e.target.value)}
              placeholder="e.g. 32"
            />
          </Labeled>
          <Labeled label="Entry fee (USD)" htmlFor="ce-fee" error={errors.entryFee}>
            <input
              id="ce-fee"
              type="number"
              min={0}
              step="0.01"
              className={styles.control}
              value={form.entryFee}
              onChange={(e) => set("entryFee", e.target.value)}
              placeholder="0 for free"
            />
          </Labeled>

          <Labeled full label="Duration" htmlFor="ce-dur" error={errors.durationMinutes}>
            <select id="ce-dur" className={styles.control} value={form.durationMinutes} onChange={(e) => set("durationMinutes", e.target.value)}>
              <option value="" disabled>
                Choose…
              </option>
              {DURATIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </Labeled>

          <Labeled full label="Format" htmlFor="ce-format" error={errors.format}>
            <input
              id="ce-format"
              className={styles.control}
              value={form.format}
              onChange={(e) => set("format", e.target.value)}
              maxLength={LIMITS.format.max}
              placeholder="e.g. Standard Constructed · 4 rounds Swiss"
            />
          </Labeled>

          <Labeled full label="Prizes" htmlFor="ce-prizes" error={errors.prizes}>
            <input
              id="ce-prizes"
              className={styles.control}
              value={form.prizes}
              onChange={(e) => set("prizes", e.target.value)}
              maxLength={LIMITS.prizes.max}
              placeholder="e.g. Booster packs + a foil promo"
            />
          </Labeled>

          <Labeled full label="Description" htmlFor="ce-desc" error={errors.description}>
            <textarea
              id="ce-desc"
              className={`${styles.control} ${styles.textarea}`}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              maxLength={LIMITS.description.max}
              rows={4}
              placeholder="What should players expect? Format, vibe, what to bring…"
            />
          </Labeled>
        </div>

        {errors._form ? (
          <p className={styles.formError} role="alert">
            {errors._form}
          </p>
        ) : null}

        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={safeClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Create Event
          </Button>
        </div>
      </form>
    </Modal>
  );
}
