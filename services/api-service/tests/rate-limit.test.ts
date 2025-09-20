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

const pipeline = {
  incr: vi.fn().mockReturnThis(),
  expire: vi.fn().mockReturnThis(),
  exec: vi.fn(),
};

const redisTtl = vi.fn();

vi.mock("../src/redis.ts", () => ({
  redis: {
    multi: vi.fn(() => pipeline),
    ttl: redisTtl,
  },
}));

describe("rateLimitCreate", () => {
beforeEach(() => {
  vi.clearAllMocks();
  pipeline.incr.mockClear();
  pipeline.expire.mockClear();
  pipeline.exec.mockClear();
  redisTtl.mockReset();
});

  it("allows requests under the limit", async () => {
    pipeline.exec.mockResolvedValueOnce([1]);
    const { rateLimitCreate } = await import("../src/middlewares/rate-limit.ts");

    const next = vi.fn();
    const res = createResponse();
    const req = createRequest("203.0.113.10");

    await rateLimitCreate(req, res as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBeUndefined();
  });

  it("blocks requests over the limit and sets Retry-After", async () => {
    pipeline.exec.mockResolvedValueOnce([31]);
    redisTtl.mockResolvedValueOnce(120);
    const { rateLimitCreate } = await import("../src/middlewares/rate-limit.ts");

    const next = vi.fn();
    const res = createResponse();
    const req = createRequest("203.0.113.10");

    await rateLimitCreate(req, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res.headers["Retry-After"]).toBe("120");
    expect(res.jsonBody).toEqual({ message: "Rate limit exceeded. Please try again later." });
  });
});

function createRequest(ip: string) {
  return {
    headers: {},
    ip,
    socket: { remoteAddress: ip },
  } as any;
}

function createResponse() {
  return {
    statusCode: undefined as number | undefined,
    headers: {} as Record<string, string>,
    jsonBody: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.jsonBody = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
  };
}
