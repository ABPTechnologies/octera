import { z } from 'zod';

export const SignupInput = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  fullName: z.string().min(1).optional(),
});
export type SignupInput = z.infer<typeof SignupInput>;

export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInput>;

export const UserPublic = z.object({
  id: z.string(),
  email: z.string().email(),
  fullName: z.string().nullable().optional(),
  role: z.enum(['ADMIN', 'BROKER', 'CLIENT', 'USER']),
});
export type UserPublic = z.infer<typeof UserPublic>;

export const AuthResponse = z.object({
  accessToken: z.string(),
  user: UserPublic,
});
export type AuthResponse = z.infer<typeof AuthResponse>;

export const DomainSearchResult = z.object({
  domain: z.string(),
  available: z.boolean(),
  price: z.number().optional(),
  currency: z.string().optional(),
});
export type DomainSearchResult = z.infer<typeof DomainSearchResult>;
