// Fakes for the Mongoose models and the upload middleware, so no database or disk is needed.
// Each model is a constructor (for `new Course(...)`) with jest.fn static methods (for `Course.find(...)`).

const makeModel = (statics: string[], extra: Record<string, unknown> = {}) => {
  const Model: any = function (this: any, doc: any) {
    Object.assign(this, extra, doc);
    this.save = () => Model.saveImpl(this);
  };
  Model.saveImpl = jest.fn(); // make it reject to simulate a failing save()
  statics.forEach((name) => {
    Model[name] = jest.fn();
  });
  return Model;
};

export const userModule = () => ({
  User: makeModel(["findOne", "findById", "find", "findByIdAndUpdate"]),
});

export const courseModule = () => ({
  Course: makeModel([
    "find",
    "findById",
    "findByIdAndUpdate",
    "findByIdAndDelete",
    "countDocuments",
  ]),
});

export const materialModule = () => ({
  Material: makeModel(["find", "findByIdAndDelete"], { _id: "material-1", courseId: "course-1" }),
});

export const enrollmentModule = () => ({ Enrollment: makeModel([]) });

// Pretends multer parsed a file, unless a test sets uploadState.skip = true
export const uploadModule = () => {
  const uploadState = { skip: false };
  return {
    __esModule: true,
    uploadState,
    default: {
      single: () => (req: any, _res: any, next: any) => {
        if (!uploadState.skip) req.file = { path: "uploads/test-file.pdf" };
        next();
      },
    },
  };
};
