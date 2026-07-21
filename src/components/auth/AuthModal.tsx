"use client";

import { type FormEvent, type KeyboardEvent, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import Field from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import type { ApiError } from "@/lib/apiClient";
import type { UserRole } from "@/lib/types";
import { useAuth } from "./AuthProvider";
import styles from "./AuthModal.module.scss";

type AuthMode = "login" | "signup";

interface AuthModalProps {
  open: boolean;
  reason?: string;
  initialMode: AuthMode;
  onClose: () => void;
}

const EMPTY = { name: "", email: "", password: "", role: "player" as UserRole };

export default function AuthModal({ open, reason, initialMode, onClose }: AuthModalProps) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [form, setForm] = useState(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loginTabRef = useRef<HTMLButtonElement>(null);
  const signupTabRef = useRef<HTMLButtonElement>(null);
  const tabId = (m: AuthMode) => `auth-tab-${m}`;

  function switchMode(next: AuthMode) {
    setMode(next);
    setFieldErrors({});
    setFormError(null);
  }

  // WAI-ARIA tabs: Left/Right (and Up/Down) move between tabs with automatic
  // activation, Home/End jump to the ends.
  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const order: AuthMode[] = ["login", "signup"];
    const i = order.indexOf(mode);
    let next: AuthMode | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = order[(i + 1) % order.length];
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = order[(i - 1 + order.length) % order.length];
    else if (e.key === "Home") next = order[0];
    else if (e.key === "End") next = order[order.length - 1];
    if (next) {
      e.preventDefault();
      switchMode(next);
      (next === "login" ? loginTabRef : signupTabRef).current?.focus();
    }
  }

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);
    try {
      if (mode === "login") {
        await login(form.email, form.password);
      } else {
        await signup(form.name, form.email, form.password, form.role);
      }
      onClose();
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.fieldErrors) setFieldErrors(apiErr.fieldErrors);
      setFormError(apiErr.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="auth-title">
      <div className={styles.head}>
        <h2 id="auth-title" className={styles.title}>
          {mode === "login" ? "Sign In" : "Create Account"}
        </h2>
        <button className={styles.close} onClick={onClose} aria-label="Close" type="button">
          ×
        </button>
      </div>

      {reason ? <p className={styles.reason}>{reason}</p> : null}

      <div className={styles.tabs} role="tablist" aria-label="Authentication">
        <button
          ref={loginTabRef}
          type="button"
          role="tab"
          id={tabId("login")}
          aria-selected={mode === "login"}
          aria-controls="auth-panel"
          tabIndex={mode === "login" ? 0 : -1}
          className={`${styles.tab} ${mode === "login" ? styles.tabActive : ""}`}
          onClick={() => switchMode("login")}
          onKeyDown={onTabKeyDown}
        >
          Sign In
        </button>
        <button
          ref={signupTabRef}
          type="button"
          role="tab"
          id={tabId("signup")}
          aria-selected={mode === "signup"}
          aria-controls="auth-panel"
          tabIndex={mode === "signup" ? 0 : -1}
          className={`${styles.tab} ${mode === "signup" ? styles.tabActive : ""}`}
          onClick={() => switchMode("signup")}
          onKeyDown={onTabKeyDown}
        >
          Create Account
        </button>
      </div>

      <form
        className={styles.form}
        onSubmit={onSubmit}
        noValidate
        role="tabpanel"
        id="auth-panel"
        aria-labelledby={tabId(mode)}
      >
        {mode === "signup" && (
          <Field
            label="Name"
            id="auth-name"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            autoComplete="name"
            error={fieldErrors.name}
          />
        )}
        <Field
          label="Email"
          id="auth-email"
          type="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          autoComplete="email"
          error={fieldErrors.email}
        />
        <Field
          label="Password"
          id="auth-password"
          type="password"
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          error={fieldErrors.password}
        />

        {mode === "signup" && (
          <div className={styles.roleRow}>
            <span className={styles.roleLabel}>I am a</span>
            <div className={styles.roleOptions}>
              <label className={styles.roleOption}>
                <input
                  type="radio"
                  name="role"
                  checked={form.role === "player"}
                  onChange={() => update("role", "player")}
                />
                <span>Player</span>
              </label>
              <label className={styles.roleOption}>
                <input
                  type="radio"
                  name="role"
                  checked={form.role === "organizer"}
                  onChange={() => update("role", "organizer")}
                />
                <span>Organizer</span>
              </label>
            </div>
          </div>
        )}

        {formError ? (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        ) : null}

        <Button type="submit" loading={submitting} className={styles.submit}>
          {mode === "login" ? "Sign In" : "Create Account"}
        </Button>
      </form>

      <p className={styles.switch}>
        {mode === "login" ? (
          <>
            New here?{" "}
            <button type="button" className={styles.switchLink} onClick={() => switchMode("signup")}>
              Create an account
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button type="button" className={styles.switchLink} onClick={() => switchMode("login")}>
              Sign in
            </button>
          </>
        )}
      </p>
    </Modal>
  );
}
