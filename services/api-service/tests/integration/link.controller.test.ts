import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";

vi.mock("@short/observability", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  metricsMiddleware: (_req: any, _res: any, next: any) => next(),
  metricsHandler: vi.fn(),
  timeDb: vi.fn(),
  countRedis: vi.fn(),
  startTracing: vi.fn(),
}));

const redisStore = new Map<string, string>();

const inMemoryLinks = new Map<string, {
  id: string;
  slug: string;
  target_url: string;
  expires_at: string | null;
  is_active: boolean;
  created_ip_hash: string | null;
  created_at: string;
}>();

let idCounter = 0;

const poolQuery = vi.fn(async (text: string, params: any[]) => {
  if (text.includes("INSERT INTO links")) {
    const slug = params[0] as string;
    if (inMemoryLinks.has(slug)) {
      return { rows: [], rowCount: 0 };
    }
    const now = new Date().toISOString();
    const link = {
      id: `id-${++idCounter}`,
      slug,
      target_url: params[1] as string,
      expires_at: (params[2] as string | null) ?? null,
      is_active: (params[3] as boolean | null) ?? true,
      created_ip_hash: (params[4] as string | null) ?? null,
      created_at: now,
    };
    inMemoryLinks.set(slug, link);
    return {
      rows: [
        {
          slug: link.slug,
          target_url: link.target_url,
          expires_at: link.expires_at,
          is_active: link.is_active,
        },
      ],
      rowCount: 1,
    };
  }

  if (text.includes("SELECT slug, target_url, expires_at, is_active")) {
    const slug = params[0] as string;
    const link = inMemoryLinks.get(slug);
    if (!link) {
      return { rows: [], rowCount: 0 };
    }
    return {
      rows: [
        {
          slug: link.slug,
          target_url: link.target_url,
          expires_at: link.expires_at,
          is_active: link.is_active,
        },
      ],
      rowCount: 1,
    };
  }

  throw new Error(`Unhandled query in test: ${text}`);
});

vi.mock("../../src/db.ts", () => ({
  pool: {
    query: poolQuery,
  },
}));

function createPipeline() {
  let lastCount = 0;
  return {
    incr(key: string) {
      const value = Number(redisStore.get(key) ?? "0") + 1;
      redisStore.set(key, String(value));
      lastCount = value;
      return this;
    },
    expire() {
      return this;
    },
    async exec() {
      return [lastCount];
    },
  };
}

vi.mock("../../src/redis.ts", () => ({
  redis: {
    async get(key: string) {
      return redisStore.has(key) ? redisStore.get(key)! : null;
    },
    async set(key: string, value: string) {
      redisStore.set(key, value);
      return "OK";
    },
    async del(key: string) {
      const existed = redisStore.delete(key);
      return existed ? 1 : 0;
    },
    multi: () => createPipeline(),
    async ttl() {
      return 60;
    },
  },
}));

const controllerPromise = import("../../src/controllers/link.controller.ts");

describe("Link controller integration", () => {
  beforeEach(() => {
    redisStore.clear();
    inMemoryLinks.clear();
    idCounter = 0;
    poolQuery.mockClear();
  });

  it("creates and resolves an active link", async () => {
    const controller = await controllerPromise;

    const createRes = createMockResponse();
    const createReq = createMockRequest({
      method: "POST",
      body: { target_url: "https://example.com" },
    });

    await controller.create(createReq as any, createRes as any);

    expect(createRes.statusCode).toBe(201);
    const slug = createRes.jsonBody?.slug as string;
    expect(slug).toMatch(/^[0-9a-zA-Z]{7}$/);

    const resolveRes = createMockResponse();
    const resolveReq = createMockRequest({
      method: "GET",
      params: { slug },
    });

    await controller.resolveLink(resolveReq as any, resolveRes as any);

    expect(resolveRes.statusCode).toBe(302);
    expect(resolveRes.redirectLocation).toBe("https://example.com");
  });

  it("returns 410 for expired link", async () => {
    const controller = await controllerPromise;
    const slug = "expired1";
    inMemoryLinks.set(slug, {
      id: "id-1",
      slug,
      target_url: "https://expired.test",
      expires_at: new Date(Date.now() - 1000).toISOString(),
      is_active: true,
      created_ip_hash: null,
      created_at: new Date().toISOString(),
    });

    const resolveRes = createMockResponse();
    const resolveReq = createMockRequest({
      method: "GET",
      params: { slug },
    });

    await controller.resolveLink(resolveReq as any, resolveRes as any);

    expect(resolveRes.statusCode).toBe(410);
  });
});

function createMockRequest(overrides: Partial<Request> & { method: string; body?: any }) {
  return {
    method: overrides.method,
    body: overrides.body ?? {},
    params: overrides.params ?? {},
    headers: overrides.headers ?? {},
    ip: overrides.ip ?? "127.0.0.1",
    socket: { remoteAddress: "127.0.0.1" },
    get: (name: string) => (overrides.headers as any)?.[name.toLowerCase()] ?? undefined,
  } as unknown as Request;
}

function createMockResponse() {
  return {
    statusCode: undefined as number | undefined,
    jsonBody: undefined as any,
    redirectLocation: undefined as string | undefined,
    headers: new Map<string, string>(),
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.jsonBody = payload;
      if (!this.statusCode) {
        this.statusCode = 200;
      }
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers.set(name.toLowerCase(), value);
    },
    redirect(code: number, location: string) {
      this.statusCode = code;
      this.redirectLocation = location;
      return this;
    },
  };
}
