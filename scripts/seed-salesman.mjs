import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const required = {
  MONGODB_URI: process.env.MONGODB_URI,
  SALESMAN_EMAIL: process.env.SALESMAN_EMAIL,
  SALESMAN_PASSWORD: process.env.SALESMAN_PASSWORD,
};

const missing = Object.entries(required)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  console.error(`Missing env: ${missing.join(", ")}`);
  process.exit(1);
}

if (required.SALESMAN_PASSWORD.length < 1) {
  console.error("SALESMAN_PASSWORD cannot be empty.");
  process.exit(1);
}

const salesmanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, default: null },
    image: { type: String, default: null },
    role: { type: String, enum: ["partner", "salesman"], required: true },
    authProvider: {
      type: String,
      enum: ["google", "credentials"],
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  },
);

const User = mongoose.models.User || mongoose.model("User", salesmanSchema);

async function main() {
  await mongoose.connect(required.MONGODB_URI, { bufferCommands: false });

  const passwordHash = await bcrypt.hash(required.SALESMAN_PASSWORD, 10);
  const email = required.SALESMAN_EMAIL.trim().toLowerCase();
  const name = process.env.SALESMAN_NAME?.trim() || "Default Salesman";

  await User.findOneAndUpdate(
    { email },
    {
      $set: {
        name,
        passwordHash,
        role: "salesman",
        authProvider: "credentials",
        isActive: true,
      },
      $setOnInsert: {
        image: null,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
    },
  );

  console.log(`Seeded salesman: ${email}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
