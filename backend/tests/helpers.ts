import jwt from "jsonwebtoken";

// A stand-in for a Mongoose query: every chained method returns the same object,
// and awaiting it yields `result`. Pass an Error to make the awaited query fail.
export const chain = (result: unknown) => {
  const query: any = {};
  for (const method of ["select", "populate", "skip", "limit", "sort", "lean"]) {
    query[method] = jest.fn(() => query);
  }
  query.then = (resolve: any, reject: any) =>
    (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)).then(
      resolve,
      reject
    );
  return query;
};

export const tokenFor = (role: "student" | "lecturer" | "admin", userId = "user-1") =>
  `Bearer ${jwt.sign({ userId, role, email: `${role}@example.com` }, process.env.JWT_SECRET as string)}`;
