import mongoose from "mongoose";

// Throws unless MongoDB is connected and answers a ping. Used by the readiness endpoint.
export const pingDatabase = async () => {
  const { connection } = mongoose;
  if (connection.readyState !== 1 || !connection.db) {
    throw new Error("database not connected");
  }
  await connection.db.admin().ping();
};
