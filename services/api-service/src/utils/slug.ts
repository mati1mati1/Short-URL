import { randomBytes } from "node:crypto";

export const BASE62_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const BASE = BASE62_ALPHABET.length;
const ACCEPTABLE_MAX = Math.floor(256 / BASE) * BASE;

export function generateSlug(length = 7): string {
  if (length <= 0) {
    throw new Error("Slug length must be greater than 0");
  }

  const chars: string[] = [];
  while (chars.length < length) {
    const bytes = randomBytes(length);
    for (let i = 0; i < bytes.length && chars.length < length; i++) {
      const byte = bytes[i];
      if (byte >= ACCEPTABLE_MAX) {
        continue;
      }
      const index = byte % BASE;
      chars.push(BASE62_ALPHABET[index]);
    }
  }
  return chars.join("");
}
