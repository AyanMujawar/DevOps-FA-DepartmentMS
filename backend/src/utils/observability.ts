import { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";
import client from "prom-client";

// Everything the monitoring stack needs: Prometheus metrics, JSON logs and a request id per call.

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

// Traffic, errors and latency (the "golden signals") come from these two HTTP metrics.
const httpRequests = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "endpoint", "status"],
  registers: [registry],
});

const httpDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request latency in seconds",
  labelNames: ["method", "endpoint"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

// Business metrics shown on the Grafana dashboard.
export const loginAttempts = new client.Counter({
  name: "campus_connect_logins_total",
  help: "Login attempts by outcome",
  labelNames: ["outcome"],
  registers: [registry],
});

export const registrations = new client.Counter({
  name: "campus_connect_registrations_total",
  help: "Accounts created by role",
  labelNames: ["role"],
  registers: [registry],
});

export const enrollments = new client.Counter({
  name: "campus_connect_enrollments_total",
  help: "Course enrollments",
  registers: [registry],
});

// One JSON object per line so Loki can index fields like "status" and "path".
export const log = (
  level: "info" | "error",
  message: string,
  fields: Record<string, unknown> = {}
) => {
  if (process.env.NODE_ENV === "test") return;
  process.stdout.write(
    JSON.stringify({ time: new Date().toISOString(), level, message, ...fields }) + "\n"
  );
};

// Gives every request an id, then records metrics and one access-log line when it finishes.
export const requestObserver = (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime.bigint();
  const incoming = req.headers["x-request-id"];
  const requestId =
    (typeof incoming === "string" && incoming.slice(0, 64)) || randomUUID().slice(0, 12);
  res.setHeader("X-Request-ID", requestId);

  res.on("finish", () => {
    if (req.path === "/metrics") return;
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    // The route template ("/api/courses/:id") keeps the number of label values small.
    const endpoint = req.route ? `${req.baseUrl}${req.route.path}` : "unmatched";
    httpRequests.inc({ method: req.method, endpoint, status: String(res.statusCode) });
    httpDuration.observe({ method: req.method, endpoint }, seconds);
    log("info", "request", {
      request_id: requestId,
      method: req.method,
      path: req.originalUrl.split("?")[0],
      status: res.statusCode,
      duration_ms: Math.round(seconds * 100000) / 100,
    });
  });

  next();
};
