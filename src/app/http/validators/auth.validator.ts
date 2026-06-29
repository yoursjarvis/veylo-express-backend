import { z } from "zod";

export const signUpSchema = z.object({
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(20),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(20),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(255),
  redirect_to: z.string().url().optional(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  new_password: z.string().min(6).max(20),
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(6).max(20),
  new_password: z.string().min(6).max(20),
});

export const verifyEmailQuerySchema = z.object({
  token: z.string().min(10),
});
