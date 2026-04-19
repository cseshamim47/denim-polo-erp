import { Model, model, models, Schema } from "mongoose";

export type UserRole = "partner" | "salesman";
export type AuthProvider = "google" | "credentials";

export interface User {
  name: string;
  email: string;
  passwordHash?: string | null;
  image?: string | null;
  role: UserRole;
  authProvider: AuthProvider;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<User>(
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

const UserModel =
  (models.User as Model<User>) || model<User>("User", userSchema);

export default UserModel;
