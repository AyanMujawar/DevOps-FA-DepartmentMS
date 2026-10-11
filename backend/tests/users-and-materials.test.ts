import request from "supertest";
import app from "../src/app";
import { Course } from "../src/models/Course";
import { Material } from "../src/models/Material";
import { User } from "../src/models/User";
import { chain, tokenFor } from "./helpers";

const UserMock = User as any;
const CourseMock = Course as any;
const MaterialMock = Material as any;
const uploadState = require("../src/middlewares/uploadMiddleware").uploadState;

const student = { Authorization: tokenFor("student", "student-1") };
const lecturer = { Authorization: tokenFor("lecturer", "lecturer-1") };
const admin = { Authorization: tokenFor("admin", "admin-1") };

describe("users", () => {
  it("lists users without passwords (admin), 500 on failure", async () => {
    const query = chain([{ name: "A" }]);
    UserMock.find.mockReturnValueOnce(query);
    expect((await request(app).get("/api/users").set(admin)).status).toBe(200);
    expect(query.select).toHaveBeenCalledWith("-password");

    UserMock.find.mockReturnValueOnce(chain(new Error("db down")));
    expect((await request(app).get("/api/users").set(admin)).status).toBe(500);
  });

  it("gets one user: 200, 404, 500", async () => {
    UserMock.findById.mockReturnValueOnce(chain({ name: "A" }));
    expect((await request(app).get("/api/users/u1").set(student)).status).toBe(200);

    UserMock.findById.mockReturnValueOnce(chain(null));
    expect((await request(app).get("/api/users/u1").set(student)).status).toBe(404);

    UserMock.findById.mockReturnValueOnce(chain(new Error("db down")));
    expect((await request(app).get("/api/users/u1").set(student)).status).toBe(500);
  });

  it("updates a user: 200, 404, 500", async () => {
    const body = { name: "New", email: "n@example.com", role: "student" };
    UserMock.findByIdAndUpdate.mockResolvedValueOnce({ name: "New" });
    expect((await request(app).put("/api/users/u1").send(body)).status).toBe(200);

    UserMock.findByIdAndUpdate.mockResolvedValueOnce(null);
    expect((await request(app).put("/api/users/u1").send(body)).status).toBe(404);

    UserMock.findByIdAndUpdate.mockRejectedValueOnce(new Error("db down"));
    expect((await request(app).put("/api/users/u1").send(body)).status).toBe(500);
  });
});

describe("materials", () => {
  afterEach(() => {
    uploadState.skip = false;
  });

  it("a student cannot upload", async () => {
    const res = await request(app).post("/api/materials/c1").set(student).send({ title: "Notes" });
    expect(res.status).toBe(403);
  });

  it("a lecturer uploads a file and the course links to it", async () => {
    CourseMock.findByIdAndUpdate.mockResolvedValueOnce({});
    const res = await request(app).post("/api/materials/c1").set(lecturer).send({ title: "Notes" });

    expect(res.status).toBe(201);
    expect(MaterialMock.saveImpl).toHaveBeenCalledTimes(1);
    expect(CourseMock.findByIdAndUpdate).toHaveBeenCalledWith("c1", {
      $addToSet: { materials: "material-1" },
    });
  });

  it("upload without a file is a 400", async () => {
    uploadState.skip = true;
    const res = await request(app).post("/api/materials/c1").set(lecturer).send({ title: "Notes" });
    expect(res.status).toBe(400);
  });

  it("upload returns 500 when saving fails", async () => {
    MaterialMock.saveImpl.mockRejectedValueOnce(new Error("db down"));
    const res = await request(app).post("/api/materials/c1").set(lecturer).send({ title: "Notes" });
    expect(res.status).toBe(500);
  });

  it("lists materials of a course, 500 on failure", async () => {
    MaterialMock.find.mockResolvedValueOnce([{ title: "Notes" }]);
    const ok = await request(app).get("/api/materials/c1").set(student);
    expect(ok.status).toBe(200);
    expect(MaterialMock.find).toHaveBeenCalledWith({ courseId: "c1" });

    MaterialMock.find.mockRejectedValueOnce(new Error("db down"));
    expect((await request(app).get("/api/materials/c1").set(student)).status).toBe(500);
  });

  it("delete removes the material and unlinks it from the course", async () => {
    MaterialMock.findByIdAndDelete.mockResolvedValueOnce({ courseId: "course-1" });
    CourseMock.findByIdAndUpdate.mockResolvedValueOnce({});
    const res = await request(app).delete("/api/materials/m1").set(lecturer);

    expect(res.status).toBe(200);
    expect(CourseMock.findByIdAndUpdate).toHaveBeenCalledWith("course-1", {
      $pull: { materials: "m1" },
    });
  });

  it("delete: 404 when missing, 500 on failure, 403 for students", async () => {
    MaterialMock.findByIdAndDelete.mockResolvedValueOnce(null);
    expect((await request(app).delete("/api/materials/m1").set(admin)).status).toBe(404);

    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    MaterialMock.findByIdAndDelete.mockRejectedValueOnce(new Error("db down"));
    expect((await request(app).delete("/api/materials/m1").set(admin)).status).toBe(500);
    consoleError.mockRestore();

    expect((await request(app).delete("/api/materials/m1").set(student)).status).toBe(403);
  });
});
