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

const poolQuery = vi.fn();

vi.mock("../src/db.ts", () => ({
  pool: {
    query: poolQuery,
  },
}));

const servicePromise = import("../src/services/link.service.ts");

describe("resolveLink", () => {
  beforeEach(() => {
    redisGet.mockReset();
    redisSet.mockReset();
    redisDel.mockReset();
    poolQuery.mockReset();
  });

  it("returns cached value when present", async () => {
    const cached = { u: "https://example.com", x: null, a: true };
    redisGet.mockResolvedValueOnce(JSON.stringify(cached));

    const { resolveLink } = await servicePromise;
    const result = await resolveLink("abc123");

    expect(result).toEqual({ u: "https://example.com", expires_at: null, is_active: true });
    expect(poolQuery).not.toHaveBeenCalled();
    expect(redisSet).not.toHaveBeenCalled();
  });

  it("looks up the database and caches the result on cache miss", async () => {
    redisGet.mockResolvedValueOnce(null);
    poolQuery.mockResolvedValueOnce({
      rows: [
        {
          slug: "abc123",
          target_url: "https://example.com",
          expires_at: null,
          is_active: true,
        },
      ],
    });
    redisSet.mockResolvedValueOnce("OK");

    const { resolveLink } = await servicePromise;
    const result = await resolveLink("abc123");

    expect(result).toEqual({ u: "https://example.com", expires_at: null, is_active: true });
    expect(poolQuery).toHaveBeenCalledTimes(1);
    expect(redisSet).toHaveBeenCalledTimes(1);
  });

  it("returns null when the slug is not found", async () => {
    redisGet.mockResolvedValueOnce(null);
    poolQuery.mockResolvedValueOnce({ rows: [] });

    const { resolveLink } = await servicePromise;
    const result = await resolveLink("missing");

    expect(result).toBeNull();
    expect(redisSet).not.toHaveBeenCalled();
  });
});
