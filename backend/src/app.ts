import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import courseRoutes from "./routes/course.routes";
import materialRoutes from "./routes/material.routes";
import { assertProductionConfig } from "./utils/config";
import { pingDatabase } from "./utils/database";
import { log, registry, requestObserver } from "./utils/observability";

dotenv.config();
assertProductionConfig(process.env);

const app = express();
app.disable("x-powered-by");

// Request ids, Prometheus metrics and JSON access logs (see utils/observability.ts)
app.use(requestObserver);

app.get("/", (_req, res) => {
  res.json({
    message: "Welcome to Campus connect Backend API",
  });
});

// Liveness: "is the process up?" Deliberately does not touch the database, so a database
// outage does not make an orchestrator restart healthy API containers.
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", message: "Campus Connect API is running" });
});

// Readiness: "can this instance serve traffic?" Verifies MongoDB answers.
app.get("/api/ready", async (_req, res) => {
  try {
    await pingDatabase();
    res.json({ status: "ready", database: "up" });
  } catch (error) {
    log("error", "readiness check failed: database unreachable");
    res.status(503).json({ status: "unavailable", database: "down" });
  }
});

// Prometheus scrapes this. nginx does not forward it, so it is not reachable from outside.
app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", registry.contentType);
  res.end(await registry.metrics());
});

// Middleware
const allowedOrigins = [
  /^http:\/\/localhost:\d+$/,
  process.env.FRONTEND_URL || "https://department-ms.vercel.app",
];

// A browser sends an Origin header even for same-origin POST/PUT/DELETE calls. Behind the nginx proxy the
// site and the API share one address, so a request whose Origin matches the Host it was sent to is always allowed.
const isSameOrigin = (origin: string, host?: string) => {
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false; // not a valid URL
  }
};

app.use(
  cors((req, callback) => {
    const origin = req.headers.origin;
    const options = {
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    };

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, options);

    const isAllowed = allowedOrigins.some((allowedOrigin) =>
      allowedOrigin instanceof RegExp
        ? allowedOrigin.test(origin)
        : allowedOrigin === origin
    );

    if (isAllowed || isSameOrigin(origin, req.headers.host)) {
      return callback(null, options);
    }
    return callback(new Error("CORS not allowed"));
  })
);
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/materials", materialRoutes);

// Unknown URLs get a JSON 404 instead of an HTML page
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: "Not found", data: null });
});

// Any uncaught error becomes a logged JSON 500 instead of an HTML stack trace
app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
  log("error", "unhandled exception", {
    path: req.originalUrl.split("?")[0],
    error: error.message,
  });
  res.status(500).json({ success: false, message: "Internal server error", data: null });
});

// Start the database connection and the HTTP server only when run directly (not when tests import the app)
if (require.main === module) {
  mongoose
    .connect(process.env.MONGODB_URI as string)
    .then(() => log("info", "Connected to MongoDB"))
    .catch((err) => log("error", "MongoDB connection error", { error: String(err) }));

  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    log("info", `Server listening at port: ${port}`);
  });
}

export default app;
