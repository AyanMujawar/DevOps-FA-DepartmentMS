import request from "supertest";
import app from "../src/app";
import { Course } from "../src/models/Course";
import { User } from "../src/models/User";
import { chain, tokenFor } from "./helpers";

const CourseMock = Course as any;
const UserMock = User as any;

describe("authentication", () => {
  it("rejects a request without a token", async () => {
    const res = await request(app).get("/api/courses");
    expect(res.status).toBe(401);
  });

  it("rejects a garbage token", async () => {
    const res = await request(app).get("/api/courses").set("Authorization", "Bearer not-a-token");
    expect(res.status).toBe(401);
  });
});

describe("role checks", () => {
  it("a student cannot create a course, a lecturer can", async () => {
    const body = { title: "Maths", courseCode: "MTH101", description: "x", lecturer: "l1" };
    const denied = await request(app).post("/api/courses").set("Authorization", tokenFor("student")).send(body);
    expect(denied.status).toBe(403);

    const created = await request(app).post("/api/courses").set("Authorization", tokenFor("lecturer")).send(body);
    expect(created.status).toBe(201);
    expect(CourseMock.saveImpl).toHaveBeenCalledTimes(1);
  });

  it("only an admin can list all users", async () => {
    const denied = await request(app).get("/api/users").set("Authorization", tokenFor("student"));
    expect(denied.status).toBe(403);

    UserMock.find.mockReturnValue(chain([{ _id: "u1" }]));
    const allowed = await request(app).get("/api/users").set("Authorization", tokenFor("admin"));
    expect(allowed.status).toBe(200);
    expect(allowed.body.data).toHaveLength(1);
  });

  it("only an admin can delete a course", async () => {
    const denied = await request(app).delete("/api/courses/c1").set("Authorization", tokenFor("lecturer"));
    expect(denied.status).toBe(403);

    CourseMock.findByIdAndDelete.mockResolvedValue({ _id: "c1" });
    const allowed = await request(app).delete("/api/courses/c1").set("Authorization", tokenFor("admin"));
    expect(allowed.status).toBe(200);
  });
});
