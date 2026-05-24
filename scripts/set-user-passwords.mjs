import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const required = {
  MONGODB_URI: process.env.MONGODB_URI,
};

for (const [key, value] of Object.entries(required)) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const DEFAULT_PASSWORD = "123";

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["partner", "salesman"],
      required: true,
    },
    isActive: { type: Boolean, default: true },
    passwordHash: { type: String, default: null },
  },
  {
    collection: "users",
  },
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

async function main() {
  await mongoose.connect(required.MONGODB_URI, { bufferCommands: false });

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const result = await User.updateMany(
    {
      isActive: true,
      role: { $in: ["partner", "salesman"] },
    },
    {
      $set: {
        passwordHash,
      },
    },
  );

  console.log("Updated user passwords:", {
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
    roles: ["partner", "salesman"],
  });
}

main()
  .catch((error) => {
    console.error("Password seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
