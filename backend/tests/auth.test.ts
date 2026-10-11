import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../src/app";
import { User } from "../src/models/User";
import { comparePassword, generateToken, hashPassword } from "../src/utils/auth";
import { chain, tokenFor } from "./helpers";

const UserMock = User as any;

describe("POST /api/auth/signup", () => {
  it("creates a user and stores a hashed password", async () => {
    UserMock.findOne.mockReturnValue(chain(null));
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ name: "Asha", email: "asha@example.com", password: "plain-pw", role: "student" });

    expect(res.status).toBe(201);
    const saved = UserMock.saveImpl.mock.calls[0][0];
    expect(saved.password).not.toBe("plain-pw");
    expect(saved.password.startsWith("$2")).toBe(true); // bcrypt hash
  });

  it("rejects an email that already exists", async () => {
    UserMock.findOne.mockReturnValue(chain({ _id: "u1" }));
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ name: "A", email: "a@example.com", password: "pw", role: "student" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("User already exists");
  });

  it("returns a JSON 500 when the database fails", async () => {
    UserMock.findOne.mockReturnValue(chain(null));
    UserMock.saveImpl.mockRejectedValueOnce(new Error("db down"));
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ name: "A", email: "a@example.com", password: "pw", role: "student" });
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Internal server error");
  });
});

describe("POST /api/auth/login", () => {
  const storedUser = async (role = "student") => {
    const password = await hashPassword("correct-pw");
    const doc = { _id: "u1", name: "Asha", email: "asha@example.com", role, password };
    return { ...doc, toObject: () => ({ ...doc }) };
  };

  it("returns 404 for an unknown email", async () => {
    UserMock.findOne.mockReturnValue(chain(null));
    const res = await request(app).post("/api/auth/login").send({ email: "x@example.com", password: "pw" });
    expect(res.status).toBe(404);
  });

  it("returns 401 for a wrong password", async () => {
    UserMock.findOne.mockReturnValue(chain(await storedUser()));
    const res = await request(app).post("/api/auth/login").send({ email: "asha@example.com", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("returns a token and never the password on success", async () => {
    UserMock.findOne.mockReturnValue(chain(await storedUser("lecturer")));
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "asha@example.com", password: "correct-pw" });

    expect(res.status).toBe(200);
    expect(res.body.data.user.password).toBeUndefined();
    const payload = jwt.verify(res.body.data.token, process.env.JWT_SECRET as string) as any;
    expect(payload.role).toBe("lecturer");
    expect(payload.userId).toBe("u1");
  });

  it("returns a JSON 500 when the database fails", async () => {
    UserMock.findOne.mockReturnValue(chain(new Error("db down")));
    const res = await request(app).post("/api/auth/login").send({ email: "a@example.com", password: "pw" });
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe("logout and token verification", () => {
  it("logout needs a token", async () => {
    expect((await request(app).post("/api/auth/logout")).status).toBe(401);
    const ok = await request(app).post("/api/auth/logout").set("Authorization", tokenFor("student"));
    expect(ok.status).toBe(200);
  });

  it("verify: no token -> 401, bad token -> 401", async () => {
    expect((await request(app).get("/api/auth/verify")).status).toBe(401);
    const bad = await request(app).get("/api/auth/verify").set("Authorization", "Bearer garbage");
    expect(bad.status).toBe(401);
  });

  it("verify: returns the user for a valid token, 404 if the user is gone", async () => {
    UserMock.findById.mockReturnValueOnce(chain({ _id: "user-1", name: "Asha" }));
    const found = await request(app).get("/api/auth/verify").set("Authorization", tokenFor("student"));
    expect(found.status).toBe(200);
    expect(found.body.data.name).toBe("Asha");

    UserMock.findById.mockReturnValueOnce(chain(null));
    const gone = await request(app).get("/api/auth/verify").set("Authorization", tokenFor("student"));
    expect(gone.status).toBe(404);
  });
});

describe("password and token helpers", () => {
  it("hashes and compares passwords", async () => {
    const hash = await hashPassword("secret-pw");
    expect(hash).not.toBe("secret-pw");
    expect(await comparePassword("secret-pw", hash)).toBe(true);
    expect(await comparePassword("other", hash)).toBe(false);
  });

  it("puts only id, email and role in the token", () => {
    const token = generateToken({ _id: "u9", email: "e@example.com", role: "admin", password: "hash" });
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    expect(payload).toMatchObject({ userId: "u9", email: "e@example.com", role: "admin" });
    expect(payload.password).toBeUndefined();
  });
});
