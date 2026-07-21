import { z } from "zod";

// A pragmatic email check that behaves identically across zod versions (avoids
// the string().email() vs z.email() API churn). Real deliverability is proven
// by sending mail, not by regex — this only rejects obviously invalid input.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80, "Name is too long."),
  email: z.string().trim().min(1, "Email is required.").max(200).regex(EMAIL, "Enter a valid email."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(200, "Password is too long."),
  role: z.enum(["player", "organizer"]).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required.").max(200).regex(EMAIL, "Enter a valid email."),
  password: z.string().min(1, "Password is required."),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
