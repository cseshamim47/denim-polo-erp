import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongoServer: MongoMemoryServer | null = null;

export async function startTestDatabase() {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();

  const { connectToDatabase } = await import("../../lib/db");
  await connectToDatabase();
}

export async function clearTestDatabase() {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  for (const collection of Object.values(mongoose.connection.collections)) {
    await collection.deleteMany({});
  }
}

export async function stopTestDatabase() {
  await mongoose.disconnect();

  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}
