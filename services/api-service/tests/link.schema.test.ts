import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadSchema() {
  return await import("../src/validation/link.schema.ts");
}

describe("createLinkSchema", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.URL_BLOCKLIST;
  });

  it("accepts a standard https URL", async () => {
    const { createLinkSchema } = await loadSchema();
    const result = createLinkSchema.safeParse({ target_url: "https://example.com" });
    expect(result.success).toBe(true);
  });

  it("rejects blocked localhost hostnames", async () => {
    const { createLinkSchema } = await loadSchema();
    const result = createLinkSchema.safeParse({ target_url: "http://localhost:3000" });
    expect(result.success).toBe(false);
    expect(result.success ? undefined : result.error.issues[0].message).toBe("Target host is not allowed");
  });

  it("rejects private network IP addresses", async () => {
    const { createLinkSchema } = await loadSchema();
    const result = createLinkSchema.safeParse({ target_url: "http://192.168.1.15/foo" });
    expect(result.success).toBe(false);
    expect(result.success ? undefined : result.error.issues[0].message).toBe("Target host is not allowed");
  });

  it("rejects protocols other than http/https", async () => {
    const { createLinkSchema } = await loadSchema();
    const result = createLinkSchema.safeParse({ target_url: "ftp://example.com" });
    expect(result.success).toBe(false);
    expect(result.success ? undefined : result.error.issues[0].message).toBe("Protocol must be http or https");
  });

  it("honours the URL_BLOCKLIST environment override", async () => {
    process.env.URL_BLOCKLIST = "blocked.com";
    const { createLinkSchema } = await loadSchema();
    const result = createLinkSchema.safeParse({ target_url: "https://blocked.com/page" });
    expect(result.success).toBe(false);
    expect(result.success ? undefined : result.error.issues[0].message).toBe("Target host is not allowed");
  });
});
