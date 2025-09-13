import { z } from "zod";

export const createLinkSchema = z.object({
  target_url: z.string().url({ message: "Must be a valid URL" }),
  title: z.string().min(1).max(200).optional(), 
  expires_at: z
    .string()
    .datetime({ offset: true, message: "Must be ISO 8601 with timezone" })
    .refine((s) => new Date(s) > new Date(), { message: "Expiration must be in the future" })
    .optional(),
  is_active: z.boolean().optional(),
  created_ip_hash: z
    .string()
    .length(64, "Must be 64 hex characters")
    .regex(/^[0-9a-f]+$/i, { message: "Must be hex" })
    .optional(),
});

export const updateLinkSchema = createLinkSchema.partial();
