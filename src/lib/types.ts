// Shared DTOs used across the server (services / route handlers) and the client
// (React components). Keep this file free of runtime/Node imports so it is safe
// to import from client components.

export type UserRole = "player" | "organizer";

/** The minimal, non-sensitive user identity carried in the session cookie. */
export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

/** An event as serialized to the client. `startsAt` is an ISO-8601 string. */
export interface EventDTO {
  id: number;
  title: string;
  gameType: string;
  startsAt: string;
  location: string;
  capacity: number;
  seatsTaken: number;
  seatsLeft: number;
  isFull: boolean;
  /** Whether the requesting user already holds an active RSVP for this event. */
  viewerJoined: boolean;
}
