import { z } from "zod";

export const emailSchema = z.email({ error: "Enter a valid email." }).trim().toLowerCase();

export const passwordSchema = z
  .string({ error: "Enter a password." })
  .min(8, { error: "Use at least 8 characters." });

export const credentialsSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const magicLinkSchema = z.object({
  email: emailSchema,
});

export const nameSchema = z.string({ error: "Enter a name." }).trim().min(1, { error: "Enter a name." }).max(60);

export const changePasswordSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], error: "The passwords do not match." });
