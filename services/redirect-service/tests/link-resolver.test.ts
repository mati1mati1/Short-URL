import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@short/observability", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  countRedis: vi.fn(),
}));

const redisGet = vi.fn<(key: string) => Promise<string | null>>();
const redisSet = vi.fn<(key: string, value: string, options?: unknown) => Promise<unknown>>();
const redisDel = vi.fn<(key: string) => Promise<unknown>>();

vi.mock("../src/redis.ts", () => ({
  redis: {
    get: redisGet,
    set: redisSet,
    del: redisDel,
  },
}));

const getLinkBySlug = vi.fn<(slug: string) => Promise<any>>();

vi.mock("../src/db.ts", () => ({
  getLinkBySlug,
}));

const resolverPromise = import("../src/link-resolver.ts");

describe("resolveSlug", () => {
  beforeEach(() => {
    redisGet.mockReset();
    redisSet.mockReset();
    redisDel.mockReset();
    getLinkBySlug.mockReset();
  });

  it("returns cached entries without hitting the database", async () => {
    redisGet.mockResolvedValueOnce(JSON.stringify({ u: "https://example.com", x: null, a: true }));
    const { resolveSlug } = await resolverPromise;

    const result = await resolveSlug("abc123");

    expect(result).toEqual({ target_url: "https://example.com", expires_at: null, is_active: true });
    expect(getLinkBySlug).not.toHaveBeenCalled();
  });

  it("queries the database and caches active links on a miss", async () => {
    redisGet.mockResolvedValueOnce(null);
    getLinkBySlug.mockResolvedValueOnce({
      slug: "abc123",
      target_url: "https://example.com",
      expires_at: null,
      is_active: true,
    });
    redisSet.mockResolvedValueOnce("OK");

    const { resolveSlug } = await resolverPromise;
    const result = await resolveSlug("abc123");

    expect(result).toEqual({ target_url: "https://example.com", expires_at: null, is_active: true });
    expect(redisSet).toHaveBeenCalledTimes(1);
  });

  it("returns null when the slug is not found anywhere", async () => {
    redisGet.mockResolvedValueOnce(null);
    getLinkBySlug.mockResolvedValueOnce(null);

    const { resolveSlug } = await resolverPromise;
    const result = await resolveSlug("missing");

    expect(result).toBeNull();
    expect(redisSet).not.toHaveBeenCalled();
  });
});
