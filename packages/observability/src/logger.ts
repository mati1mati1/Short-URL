import pino from "pino";
import fs from "fs";
import path from "path";

export function createLogger(serviceName = process.env.SERVICE_NAME ?? "service") {
  const logsDir = "/app/logs";
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const logFile = path.join(logsDir, `${serviceName}.log`);
  
  const streams = [
    {
      level: process.env.LOG_LEVEL ?? "info",
      stream: process.stdout
    },
    {
      level: process.env.LOG_LEVEL ?? "info",
      stream: pino.destination({
        dest: logFile,
        sync: false
      })
    }
  ];

  return pino({
    level: process.env.LOG_LEVEL ?? "info",
    base: { service: serviceName },
    formatters: { level: (label) => ({ level: label }) },
    messageKey: "msg",
    timestamp: pino.stdTimeFunctions.isoTime
  }, pino.multistream(streams));
}

export const logger = createLogger();
