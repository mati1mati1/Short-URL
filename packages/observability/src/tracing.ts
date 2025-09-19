// Optional, robust start that won't crash if OTel isn't present
export async function startTracing(serviceName = process.env.SERVICE_NAME ?? "service") {
  try {
    const [{ NodeSDK }, { OTLPTraceExporter }, { getNodeAutoInstrumentations }] = await Promise.all([
      import("@opentelemetry/sdk-node"),
      import("@opentelemetry/exporter-trace-otlp-http"),
      import("@opentelemetry/auto-instrumentations-node")
    ]);

    const exporter = new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || "http://otel-collector:4318/v1/traces"
    });

    const sdk = new NodeSDK({
      serviceName,
      traceExporter: exporter,
      instrumentations: [getNodeAutoInstrumentations()]
    });

    await sdk.start();
    process.on("SIGTERM", async () => { await sdk.shutdown(); process.exit(0); });
    console.log("[otel] tracing started");
  } catch (err) {
    console.warn("[otel] tracing disabled:", (err as Error).message);
  }
}
