import request from "supertest";
import * as database from "../src/utils/database";
import app from "../src/app";
import { User } from "../src/models/User";
import { assertProductionConfig } from "../src/utils/config";
import { chain } from "./helpers";

const UserMock = User as any;

afterEach(() => {
  jest.restoreAllMocks();
});

describe("health and readiness", () => {
  it("/api/health answers without touching the database", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("/api/ready is 200 when MongoDB answers", async () => {
    jest.spyOn(database, "pingDatabase").mockResolvedValue(undefined);
    const res = await request(app).get("/api/ready");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ready", database: "up" });
  });

  it("/api/ready is 503 when MongoDB is not connected", async () => {
    // no mock: in tests there is no MongoDB connection, so the real check fails
    const res = await request(app).get("/api/ready");
    expect(res.status).toBe(503);
    expect(res.body.database).toBe("down");
  });

  it("/api/ready is 503 when the ping fails", async () => {
    jest.spyOn(database, "pingDatabase").mockRejectedValue(new Error("timeout"));
    expect((await request(app).get("/api/ready")).status).toBe(503);
  });
});

describe("metrics", () => {
  it("exposes request counters labelled with the route template", async () => {
    await request(app).get("/api/health");
    const res = await request(app).get("/metrics");

    expect(res.status).toBe(200);
    expect(res.text).toContain("http_requests_total");
    expect(res.text).toContain("http_request_duration_seconds_bucket");
    expect(res.text).toContain('endpoint="/api/health"');
  });

  it("uses '/api/courses/:id' instead of the concrete id (keeps labels small)", async () => {
    await request(app)
      .get("/api/courses/507f1f77bcf86cd799439011")
      .set("Authorization", "Bearer garbage");
    const res = await request(app).get("/metrics");
    expect(res.text).not.toContain("507f1f77bcf86cd799439011");
  });

  it("does not count the /metrics scrape itself", async () => {
    await request(app).get("/metrics");
    const res = await request(app).get("/metrics");
    expect(res.text).not.toContain('endpoint="/metrics"');
  });

  it("counts login outcomes", async () => {
    UserMock.findOne.mockReturnValue(chain(null));
    await request(app).post("/api/auth/login").send({ email: "x@example.com", password: "pw" });
    const res = await request(app).get("/metrics");
    expect(res.text).toMatch(/campus_connect_logins_total\{outcome="failure"\} [1-9]/);
  });
});

describe("request ids, errors and headers", () => {
  it("echoes a supplied X-Request-ID and creates one otherwise", async () => {
    const given = await request(app).get("/api/health").set("X-Request-ID", "abc123");
    expect(given.headers["x-request-id"]).toBe("abc123");

    const generated = await request(app).get("/api/health");
    expect(generated.headers["x-request-id"]).toBeTruthy();
  });

  it("returns a JSON 404 for unknown URLs", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("does not advertise the framework", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("CORS: allows the configured frontend, rejects other origins", async () => {
    // /api/courses sits behind the CORS middleware; with no token an allowed origin reaches the auth check (401)
    const allowed = await request(app).get("/api/courses").set("Origin", "http://localhost:3000");
    expect(allowed.status).toBe(401);

    const blocked = await request(app).get("/api/courses").set("Origin", "http://evil.example");
    expect(blocked.status).toBe(500);
  });

  it("CORS: a request from the same address it was sent to is allowed (site and API share one origin)", async () => {
    const same = await request(app)
      .get("/api/courses")
      .set("Host", "campus.example:8088")
      .set("Origin", "http://campus.example:8088");
    expect(same.status).toBe(401);

    const other = await request(app)
      .get("/api/courses")
      .set("Host", "campus.example")
      .set("Origin", "http://campus.example:8088");
    expect(other.status).toBe(500);

    const garbage = await request(app).get("/api/courses").set("Origin", "not a url");
    expect(garbage.status).toBe(500);
  });
});

describe("production configuration guard", () => {
  const strong = "a-long-random-production-secret";

  it("does nothing outside production", () => {
    expect(() => assertProductionConfig({ NODE_ENV: "development" })).not.toThrow();
  });

  it("refuses a missing, default or short JWT_SECRET in production", () => {
    const env = { NODE_ENV: "production", MONGODB_URI: "mongodb://db/x" };
    expect(() => assertProductionConfig({ ...env })).toThrow(/JWT_SECRET/);
    expect(() => assertProductionConfig({ ...env, JWT_SECRET: "change-this-secret-key" })).toThrow(/JWT_SECRET/);
    expect(() => assertProductionConfig({ ...env, JWT_SECRET: "short" })).toThrow(/JWT_SECRET/);
  });

  it("requires MONGODB_URI in production", () => {
    expect(() => assertProductionConfig({ NODE_ENV: "production", JWT_SECRET: strong })).toThrow(/MONGODB_URI/);
  });

  it("accepts a strong secret", () => {
    const env = { NODE_ENV: "production", JWT_SECRET: strong, MONGODB_URI: "mongodb://db/x" };
    expect(() => assertProductionConfig(env)).not.toThrow();
  });
});
