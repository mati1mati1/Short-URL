import { describe, expect, it } from "vitest";
import { BASE62_ALPHABET, generateSlug } from "../src/utils/slug.ts";

const BASE62_REGEX = /^[0-9a-zA-Z]+$/;

describe("generateSlug", () => {
  it("returns a 7 character base62 string by default", () => {
    const slug = generateSlug();
    expect(slug).toHaveLength(7);
    expect(BASE62_REGEX.test(slug)).toBe(true);
    for (const char of slug) {
      expect(BASE62_ALPHABET.includes(char)).toBe(true);
    }
  });

  it("supports custom lengths", () => {
    const length = 12;
    const slug = generateSlug(length);
    expect(slug).toHaveLength(length);
    expect(BASE62_REGEX.test(slug)).toBe(true);
  });
});
