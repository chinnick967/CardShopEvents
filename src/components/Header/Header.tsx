"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { useEvents } from "@/components/events/EventsProvider";
import MobileMenu from "./MobileMenu";
import styles from "./Header.module.scss";

export default function Header() {
  const { user, openAuth, logout } = useAuth();
  const { openMyEvents, openCreateEvent } = useEvents();

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="Game Night — home">
          <span className={styles.mark} aria-hidden="true">
            <svg
              className={styles.cardIcon}
              viewBox="0 0 24 24"
              width="22"
              height="22"
              role="img"
            >
              <defs>
                <linearGradient id="gn-sheen" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
                  <stop offset="0.5" stopColor="#eafdff" stopOpacity="0.7" />
                  <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
                <clipPath id="gn-card-clip">
                  <rect x="8" y="4.5" width="11.5" height="15.5" rx="1.9" />
                </clipPath>
              </defs>

              {/* Back card — fans out a little further on hover. */}
              <rect
                className={styles.backCard}
                x="4.8"
                y="4.5"
                width="11.5"
                height="15.5"
                rx="1.9"
                fill="#0b1215"
                stroke="rgba(0, 240, 255, 0.42)"
                strokeWidth="1.3"
              />

              {/* Front card. */}
              <g className={styles.frontCard}>
                <rect
                  x="8"
                  y="4.5"
                  width="11.5"
                  height="15.5"
                  rx="1.9"
                  fill="#0c171a"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
                {/* Diamond pip — echoes the old ◆ mark. */}
                <path
                  className={styles.pip}
                  d="M13.75 9.4 L15.9 12.4 L13.75 15.4 L11.6 12.4 Z"
                  fill="currentColor"
                />
                {/* Light sheen that periodically sweeps across the card face. */}
                <g clipPath="url(#gn-card-clip)">
                  <rect
                    className={styles.sheen}
                    x="2"
                    y="3"
                    width="6"
                    height="19"
                    fill="url(#gn-sheen)"
                  />
                </g>
              </g>
            </svg>
          </span>
          <span className={styles.name}>
            GAME<span className={styles.accent}>NIGHT</span>
          </span>
        </Link>

        <div className={styles.right}>
          {user ? (
            <>
              <div className={styles.user}>
                <div className={styles.meta}>
                  <span className={styles.userName}>{user.name}</span>
                  <span className={styles.role}>{user.role}</span>
                </div>
                <button
                  className={styles.myEvents}
                  onClick={() => openMyEvents()}
                  type="button"
                  aria-label="My Events"
                >
                  <span className={styles.myEventsPrefix}>My </span>Events
                </button>
                {user.role === "organizer" && (
                  <button
                    className={styles.createEvent}
                    onClick={() => openCreateEvent()}
                    type="button"
                    aria-label="Create New Event"
                  >
                    <span className={styles.createPlus} aria-hidden="true">
                      +
                    </span>
                    New Event
                  </button>
                )}
                <button className={styles.signOut} onClick={() => logout()} type="button">
                  Sign out
                </button>
              </div>
              <MobileMenu
                user={user}
                onSignOut={logout}
                onOpenMyEvents={openMyEvents}
                onCreateEvent={user.role === "organizer" ? openCreateEvent : undefined}
              />
            </>
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
