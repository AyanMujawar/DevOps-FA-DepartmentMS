import request from "supertest";
import app from "../src/app";
import { Course } from "../src/models/Course";
import { chain, tokenFor } from "./helpers";

const CourseMock = Course as any;
const auth = () => ({ Authorization: tokenFor("student", "student-1") });
const boom = () => chain(new Error("db down"));

describe("GET /api/courses", () => {
  it("lists courses", async () => {
    CourseMock.find.mockReturnValue(chain([{ title: "Maths" }]));
    const res = await request(app).get("/api/courses").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data[0].title).toBe("Maths");
  });

  it("returns 500 when the database fails", async () => {
    CourseMock.find.mockReturnValue(boom());
    const res = await request(app).get("/api/courses").set(auth());
    expect(res.status).toBe(500);
  });
});

describe("GET /api/courses/lecturer/:lecturerId", () => {
  it("applies pagination and returns the lecturer's courses", async () => {
    const query = chain([{ title: "Physics" }]);
    CourseMock.find.mockReturnValue(query);
    CourseMock.countDocuments.mockResolvedValue(1);
    const res = await request(app).get("/api/courses/lecturer/l1?page=2&limit=5").set(auth());

    expect(res.status).toBe(200);
    expect(CourseMock.find).toHaveBeenCalledWith({ lecturer: "l1" });
    expect(query.skip).toHaveBeenCalledWith(5);
    expect(query.limit).toHaveBeenCalledWith(5);
  });

  it("passes database errors to the JSON error handler", async () => {
    CourseMock.find.mockReturnValue(boom());
    const res = await request(app).get("/api/courses/lecturer/l1").set(auth());
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Internal server error");
  });
});

describe("GET /api/courses/:id", () => {
  it("returns a course, 404 when missing, 500 on failure", async () => {
    CourseMock.findById.mockResolvedValueOnce({ title: "Maths" });
    expect((await request(app).get("/api/courses/c1").set(auth())).status).toBe(200);

    CourseMock.findById.mockResolvedValueOnce(null);
    expect((await request(app).get("/api/courses/c1").set(auth())).status).toBe(404);

    CourseMock.findById.mockRejectedValueOnce(new Error("db down"));
    expect((await request(app).get("/api/courses/c1").set(auth())).status).toBe(500);
  });
});

describe("course create, update and delete", () => {
  const lecturer = { Authorization: tokenFor("lecturer", "lecturer-1") };
  const admin = { Authorization: tokenFor("admin", "admin-1") };

  it("create returns 500 when saving fails", async () => {
    CourseMock.saveImpl.mockRejectedValueOnce(new Error("duplicate"));
    const res = await request(app).post("/api/courses").set(lecturer).send({ title: "T" });
    expect(res.status).toBe(500);
  });

  it("update returns the new course, 404 when missing, 500 on failure", async () => {
    CourseMock.findByIdAndUpdate.mockResolvedValueOnce({ title: "New" });
    expect((await request(app).put("/api/courses/c1").set(lecturer).send({ title: "New" })).status).toBe(200);

    CourseMock.findByIdAndUpdate.mockResolvedValueOnce(null);
    expect((await request(app).put("/api/courses/c1").set(lecturer).send({})).status).toBe(404);

    CourseMock.findByIdAndUpdate.mockRejectedValueOnce(new Error("db down"));
    expect((await request(app).put("/api/courses/c1").set(lecturer).send({})).status).toBe(500);
  });

  it("delete: 200, 404 when missing, 500 on failure", async () => {
    CourseMock.findByIdAndDelete.mockResolvedValueOnce({ _id: "c1" });
    expect((await request(app).delete("/api/courses/c1").set(admin)).status).toBe(200);

    CourseMock.findByIdAndDelete.mockResolvedValueOnce(null);
    expect((await request(app).delete("/api/courses/c1").set(admin)).status).toBe(404);

    CourseMock.findByIdAndDelete.mockRejectedValueOnce(new Error("db down"));
    expect((await request(app).delete("/api/courses/c1").set(admin)).status).toBe(500);
  });
});

describe("students of a course", () => {
  it("lists enrolled students, 404 when the course is missing, 500 on failure", async () => {
    CourseMock.findById.mockReturnValueOnce(chain({ students: [{ name: "Asha" }] }));
    const ok = await request(app).get("/api/courses/c1/students").set(auth());
    expect(ok.status).toBe(200);
    expect(ok.body.data).toEqual([{ name: "Asha" }]);

    CourseMock.findById.mockReturnValueOnce(chain(null));
    expect((await request(app).get("/api/courses/c1/students").set(auth())).status).toBe(404);

    CourseMock.findById.mockReturnValueOnce(boom());
    expect((await request(app).get("/api/courses/c1/students").set(auth())).status).toBe(500);
  });
});

describe("GET /api/courses/students (my courses)", () => {
  it("returns the student's courses, 404 when none, 500 on failure", async () => {
    CourseMock.find.mockReturnValueOnce(chain([{ title: "Maths" }]));
    const ok = await request(app).get("/api/courses/students").set(auth());
    expect(ok.status).toBe(200);
    expect(CourseMock.find).toHaveBeenCalledWith({ students: "student-1" });

    CourseMock.find.mockReturnValueOnce(chain([]));
    expect((await request(app).get("/api/courses/students").set(auth())).status).toBe(404);

    CourseMock.find.mockReturnValueOnce(boom());
    expect((await request(app).get("/api/courses/students").set(auth())).status).toBe(500);
  });
});

describe("enroll and disenroll", () => {
  it("enrolls the logged-in student using $addToSet", async () => {
    CourseMock.findByIdAndUpdate.mockReturnValueOnce(chain({ title: "Maths" }));
    const res = await request(app).post("/api/courses/c1/enroll").set(auth());
    expect(res.status).toBe(200);
    expect(CourseMock.findByIdAndUpdate).toHaveBeenCalledWith(
      "c1",
      { $addToSet: { students: "student-1" } },
      { new: true }
    );
  });

  it("enroll: 404 for a missing course, 500 on failure", async () => {
    CourseMock.findByIdAndUpdate.mockReturnValueOnce(chain(null));
    expect((await request(app).post("/api/courses/c1/enroll").set(auth())).status).toBe(404);

    CourseMock.findByIdAndUpdate.mockReturnValueOnce(boom());
    expect((await request(app).post("/api/courses/c1/enroll").set(auth())).status).toBe(500);
  });

  it("disenrolls the logged-in student using $pull", async () => {
    CourseMock.findByIdAndUpdate.mockReturnValueOnce(chain({ title: "Maths" }));
    const res = await request(app).delete("/api/courses/c1/disenroll").set(auth());
    expect(res.status).toBe(200);
    expect(CourseMock.findByIdAndUpdate).toHaveBeenCalledWith(
      "c1",
      { $pull: { students: "student-1" } },
      { new: true }
    );
  });

  it("disenroll: 404 for a missing course, 500 on failure", async () => {
    CourseMock.findByIdAndUpdate.mockReturnValueOnce(chain(null));
    expect((await request(app).delete("/api/courses/c1/disenroll").set(auth())).status).toBe(404);

    const consoleError = jest.spyOn(console, "log").mockImplementation(() => undefined);
    CourseMock.findByIdAndUpdate.mockReturnValueOnce(boom());
    expect((await request(app).delete("/api/courses/c1/disenroll").set(auth())).status).toBe(500);
    consoleError.mockRestore();
  });
});
