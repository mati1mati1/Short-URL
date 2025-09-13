import { createClient } from "redis";
import type { RedisClientType } from "redis";

const client: RedisClientType = createClient({
  url: process.env.REDIS_URL,
  password: process.env.REDIS_PASSWORD || undefined
});

async function connectRedis(): Promise<void> {
  try {
    await client.connect();
    console.log("✅ Successfully connected to Redis");
  } catch (err) {
    console.error("❌ Redis connection error:", err);
  }
}

client.on("error", (err: Error) => {
  console.error("Redis error:", err);
});



connectRedis();

export { client as redis };
