import "dotenv/config";

export const PORT = Number(process.env.REDIRECT_PORT ?? 8081);
export const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

export const API_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS ?? 2000);
