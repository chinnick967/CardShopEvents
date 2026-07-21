import bcrypt from "bcryptjs";
import { UniqueConstraintError } from "sequelize";
import { User } from "../models";
import { HttpError } from "../errors";
import type { SessionUser, UserRole } from "../../lib/types";

const SALT_ROUNDS = 10;

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}

export interface LoginInput {
  email: string;
  password: string;
}

function toSessionUser(user: User): SessionUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function signup(input: SignupInput): Promise<SessionUser> {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  try {
    const user = await User.create({
      name: input.name.trim(),
      email,
      passwordHash,
      role: input.role ?? "player",
    });
    return toSessionUser(user);
  } catch (err) {
    // The UNIQUE(email) constraint is the source of truth; catching it also
    // closes the check-then-insert race two concurrent signups could hit.
    if (err instanceof UniqueConstraintError) {
      throw new HttpError(409, "EMAIL_TAKEN", "An account with that email already exists.", {
        email: "This email is already registered.",
      });
    }
    throw err;
  }
}

export async function login(input: LoginInput): Promise<SessionUser> {
  const email = input.email.trim().toLowerCase();
  const user = await User.findOne({ where: { email } });

  // Compare against the stored hash even when the user is missing would be
  // ideal to avoid timing leaks; here we keep it simple and return one generic
  // message so we never reveal whether an email exists.
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new HttpError(401, "INVALID_CREDENTIALS", "Incorrect email or password.");
  }
  return toSessionUser(user);
}
