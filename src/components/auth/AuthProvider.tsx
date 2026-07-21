"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { SessionUser, UserRole } from "@/lib/types";
import { apiFetch } from "@/lib/apiClient";
import AuthModal from "./AuthModal";

type AuthMode = "login" | "signup";

interface AuthContextValue {
  user: SessionUser | null;
  /** Open the auth modal, optionally with a contextual reason + starting tab. */
  openAuth: (reason?: string, mode?: AuthMode) => void;
  closeAuth: () => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, role?: UserRole) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

interface ModalState {
  open: boolean;
  reason?: string;
  mode: AuthMode;
}

export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: SessionUser | null;
  children: ReactNode;
}) {
  // Seeded from the server session so the header renders correctly with no flash.
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const [modal, setModal] = useState<ModalState>({ open: false, mode: "login" });
  // Bumped on each open so the modal remounts with fresh form state (no reset effect).
  const [openKey, setOpenKey] = useState(0);

  const openAuth = useCallback((reason?: string, mode: AuthMode = "login") => {
    setModal({ open: true, reason, mode });
    setOpenKey((k) => k + 1);
  }, []);
  const closeAuth = useCallback(() => setModal((m) => ({ ...m, open: false })), []);

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await apiFetch<{ user: SessionUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(user);
  }, []);

  const signup = useCallback(
    async (name: string, email: string, password: string, role?: UserRole) => {
      const { user } = await apiFetch<{ user: SessionUser }>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ name, email, password, role }),
      });
      setUser(user);
    },
    [],
  );

  const logout = useCallback(async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, openAuth, closeAuth, login, signup, logout }}>
      {children}
      <AuthModal key={openKey} open={modal.open} reason={modal.reason} initialMode={modal.mode} onClose={closeAuth} />
    </AuthContext.Provider>
  );
}
