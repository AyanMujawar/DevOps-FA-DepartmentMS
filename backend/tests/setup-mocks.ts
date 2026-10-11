// Registered for every test file (setupFilesAfterEnv), so importing the app never opens a database.
jest.mock("../src/models/User", () => require("./mocks").userModule());
jest.mock("../src/models/Course", () => require("./mocks").courseModule());
jest.mock("../src/models/Material", () => require("./mocks").materialModule());
jest.mock("../src/models/Enrollment", () => require("./mocks").enrollmentModule());
jest.mock("../src/middlewares/uploadMiddleware", () => require("./mocks").uploadModule());
