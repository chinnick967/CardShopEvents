"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import styles from "./Header.module.scss";

export default function Header() {
  const { user, openAuth, logout } = useAuth();

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="Game Night — home">
          <span className={styles.mark} aria-hidden="true">
            ◆
          </span>
          <span className={styles.name}>
            GAME<span className={styles.accent}>NIGHT</span>
          </span>
        </Link>

        <div className={styles.right}>
          {user ? (
            <div className={styles.user}>
              <div className={styles.meta}>
                <span className={styles.userName}>{user.name}</span>
                <span className={styles.role}>{user.role}</span>
              </div>
              <button className={styles.signOut} onClick={() => logout()} type="button">
                Sign out
              </button>
            </div>
          ) : (
            <button className={styles.signIn} onClick={() => openAuth()} type="button">
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
