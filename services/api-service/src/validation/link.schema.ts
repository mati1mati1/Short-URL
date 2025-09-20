import { isIP } from "node:net";
import { z } from "zod";

const SAFE_PROTOCOLS = new Set(["http:", "https:"]);

const DEFAULT_BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
];

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".test"];

const ENV_BLOCKLIST = (process.env.URL_BLOCKLIST ?? "")
  .split(",")
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

const BLOCKED_HOSTS = new Set([...DEFAULT_BLOCKED_HOSTS, ...ENV_BLOCKLIST]);

function isPrivateIPv4(host: string): boolean {
  const octets = host.split(".").map((part) => Number(part));
  if (octets.length !== 4 || octets.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = octets;

  if (a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0) return true;

  return false;
}

function isPrivateIPv6(host: string): boolean {
  const normalized = host.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80") ||
    normalized.startsWith("fec0")
  );
}

function isBlockedHost(host: string): boolean {
  const lowered = host.toLowerCase();
  if (BLOCKED_HOSTS.has(lowered)) {
    return true;
  }

  return BLOCKED_SUFFIXES.some((suffix) => lowered.endsWith(suffix));
}

function isPrivateAddress(host: string): boolean {
  const ipVersion = isIP(host);
  if (ipVersion === 4) {
    return isPrivateIPv4(host);
  }
  if (ipVersion === 6) {
    return isPrivateIPv6(host);
  }
  return false;
}

const targetUrlSchema = z
  .string()
  .url({ message: "Must be a valid URL" })
  .superRefine((value, ctx) => {
    try {
      const url = new URL(value);

      if (!SAFE_PROTOCOLS.has(url.protocol)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Protocol must be http or https" });
        return;
      }

      if (isBlockedHost(url.hostname) || isPrivateAddress(url.hostname)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Target host is not allowed" });
      }
    } catch (error) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid URL" });
    }
  });

export const createLinkSchema = z.object({
  target_url: targetUrlSchema,
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
