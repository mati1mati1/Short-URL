
import { createClient } from "redis";
import type { RedisClientType } from "redis";
import { logger } from "@short/observability";

const client: RedisClientType = createClient({
  url: process.env.REDIS_URL,
  password: process.env.REDIS_PASSWORD || undefined
});

async function connectRedis(): Promise<void> {
  try {
  await client.connect();
  logger.info("✅ Successfully connected to Redis");
  } catch (err) {
  logger.error({ err }, "❌ Redis connection error");
  }
}

client.on("error", (err: Error) => {
  logger.error({ err }, "Redis error");
});



connectRedis();

export { client as redis };
